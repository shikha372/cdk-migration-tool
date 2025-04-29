# Migrate to VPC V2

## Overview

This guide provides detailed instructions for migrating from AWS CDK v1 VPC constructs to the new VPC v2 constructs in AWS CDK v2. The VPC v2 constructs offer improved flexibility, better control over networking resources, and align with AWS best practices.

## Key Differences

| Feature | VPC v1 | VPC v2 |
|---------|--------|--------|
| IP Addressing | `cidr` property | `primaryAddressBlock: IpAddresses.ipv4()` |
| Subnet Definition | `subnetConfiguration` array | Explicit `SubnetV2` constructs |
| NAT Gateways | `natGateways` property | `vpc.addNatGateway()` method |
| Internet Gateway | Automatically created for public subnets | Explicitly added with `vpc.addInternetGateway()` |
| Route Tables | Implicitly created | Explicitly created and associated |

## Migration Steps

### 1. Update Import Statements

```typescript
// Old imports
import * as ec2 from 'aws-cdk-lib/aws-ec2';

// New imports
import { VpcV2, SubnetV2, IpCidr, IpAddresses, RouteTable } from '@aws-cdk/aws-ec2-alpha';
```

### 2. Migrate VPC Creation

#### Before:
```typescript
const vpc = new ec2.Vpc(this, 'MyVpc', {
  cidr: '10.0.0.0/16',
  maxAzs: 3,
  subnetConfiguration: [
    {
      name: 'public',
      subnetType: ec2.SubnetType.PUBLIC,
      cidrMask: 24,
    },
    {
      name: 'private',
      subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
      cidrMask: 24,
    },
    {
      name: 'isolated',
      subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      cidrMask: 28,
    }
  ],
  natGateways: 1
});
```

#### After:
```typescript
const vpc = new VpcV2(this, 'MyVpc', {
  primaryAddressBlock: IpAddresses.ipv4('10.0.0.0/16'),
  vpcName: 'MyVpc',
  enableDnsHostnames: true,
  enableDnsSupport: true,
});

// Create route tables
const publicRouteTable = new RouteTable(this, 'PublicRouteTable', {
  vpc,
  routeTableName: 'PublicRouteTable',
});

const privateRouteTable = new RouteTable(this, 'PrivateRouteTable', {
  vpc,
  routeTableName: 'PrivateRouteTable',
});

const isolatedRouteTable = new RouteTable(this, 'IsolatedRouteTable', {
  vpc,
  routeTableName: 'IsolatedRouteTable',
});

// Create subnets
new SubnetV2(this, 'PublicSubnet1', {
  vpc,
  availabilityZone: 'us-east-1a',
  ipv4CidrBlock: new IpCidr('10.0.0.0/24'),
  subnetType: ec2.SubnetType.PUBLIC,
  subnetName: 'PublicSubnet1',
  routeTable: publicRouteTable,
});

new SubnetV2(this, 'PrivateSubnet1', {
  vpc,
  availabilityZone: 'us-east-1a',
  ipv4CidrBlock: new IpCidr('10.0.1.0/24'),
  subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
  subnetName: 'PrivateSubnet1',
  routeTable: privateRouteTable,
});

new SubnetV2(this, 'IsolatedSubnet1', {
  vpc,
  availabilityZone: 'us-east-1a',
  ipv4CidrBlock: new IpCidr('10.0.2.0/28'),
  subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
  subnetName: 'IsolatedSubnet1',
  routeTable: isolatedRouteTable,
});

// Add Internet Gateway for public subnets
vpc.addInternetGateway({
  internetGatewayName: 'MyInternetGateway',
});

// Add NAT Gateway for private subnets
vpc.addNatGateway({
  subnet: vpc.publicSubnets[0],
  natGatewayName: 'MyNatGateway',
});
```

### 3. Migrate Secondary CIDR Blocks

#### Before:
```typescript
const vpc = new ec2.Vpc(this, 'MyVpc', {
  cidr: '10.0.0.0/16',
  // Other properties...
});
```

#### After:
```typescript
const vpc = new VpcV2(this, 'MyVpc', {
  primaryAddressBlock: IpAddresses.ipv4('10.0.0.0/16'),
  secondaryAddressBlocks: [
    IpAddresses.ipv4('172.16.0.0/16'),
    IpAddresses.amazonProvidedIpv6({
      cidrBlockName: 'AmazonProvidedIpv6CidrBlock',
    }),
  ],
  // Other properties...
});
```

### 4. Migrate VPC Endpoints

#### Before:
```typescript
vpc.addGatewayEndpoint('S3Endpoint', {
  service: ec2.GatewayVpcEndpointAwsService.S3,
});

vpc.addInterfaceEndpoint('EcrEndpoint', {
  service: ec2.InterfaceVpcEndpointAwsService.ECR,
});
```

#### After:
```typescript
vpc.addGatewayEndpoint('S3Endpoint', {
  service: ec2.GatewayVpcEndpointAwsService.S3,
});

vpc.addInterfaceEndpoint('EcrEndpoint', {
  service: ec2.InterfaceVpcEndpointAwsService.ECR,
});
```

### 5. Migrate VPN Gateway

#### Before:
```typescript
vpc.enableVpnGateway({
  amazonSideAsn: 65000,
  vpnRoutePropagation: [{ subnetType: ec2.SubnetType.PRIVATE_WITH_NAT }]
});
```

#### After:
```typescript
vpc.enableVpnGatewayV2({
  type: ec2.VpnConnectionType.IPSEC_1,
  amazonSideAsn: 65000,
  vpnGatewayName: 'MyVpnGateway',
  vpnRoutePropagation: [{ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }]
});
```

### 6. Migrate VPC Peering

#### Before:
```typescript
const peeringConnection = new ec2.CfnVPCPeeringConnection(this, 'PeeringConnection', {
  vpcId: vpc.vpcId,
  peerVpcId: peerVpc.vpcId,
});
```

#### After:
```typescript
const peeringConnection = vpc.createPeeringConnection('PeeringConnection', {
  acceptorVpc: peerVpc,
  peeringConnectionName: 'MyPeeringConnection',
});
```

## Common Migration Challenges

### Challenge 1: Handling Multiple Availability Zones

When migrating from the `maxAzs` property to explicit subnet definitions, you'll need to create subnets for each AZ:

```typescript
// Get available AZs
const availabilityZones = Stack.of(this).availabilityZones;

// Create subnets in each AZ
availabilityZones.forEach((az, index) => {
  new SubnetV2(this, `PublicSubnet${index+1}`, {
    vpc,
    availabilityZone: az,
    ipv4CidrBlock: new IpCidr(`10.0.${index}.0/24`),
    subnetType: ec2.SubnetType.PUBLIC,
    subnetName: `PublicSubnet${index+1}`,
    routeTable: publicRouteTable,
  });
});
```

### Challenge 2: IPAM Integration

If you're using AWS IPAM for IP address management:

```typescript
const vpc = new VpcV2(this, 'MyVpc', {
  primaryAddressBlock: IpAddresses.ipv4Ipam({
    ipamPoolId: 'ipam-pool-12345',
    netmaskLength: 24,
  }),
  // Other properties...
});
```

### Challenge 3: Shared Route Tables

When multiple subnets share the same route table:

```typescript
// Create a shared route table
const sharedRouteTable = new RouteTable(this, 'SharedRouteTable', {
  vpc,
  routeTableName: 'SharedRouteTable',
});

// Create subnets that share the route table
new SubnetV2(this, 'PublicSubnet1', {
  vpc,
  availabilityZone: 'us-east-1a',
  ipv4CidrBlock: new IpCidr('10.0.0.0/24'),
  subnetType: ec2.SubnetType.PUBLIC,
  subnetName: 'PublicSubnet1',
  routeTable: sharedRouteTable,
});

new SubnetV2(this, 'PublicSubnet2', {
  vpc,
  availabilityZone: 'us-east-1b',
  ipv4CidrBlock: new IpCidr('10.0.1.0/24'),
  subnetType: ec2.SubnetType.PUBLIC,
  subnetName: 'PublicSubnet2',
  routeTable: sharedRouteTable,
});
```

## Testing Your Migration

After migrating your VPC constructs, it's important to:

1. Deploy to a test environment first
2. Verify subnet connectivity
3. Test internet access from public subnets
4. Validate NAT gateway functionality from private subnets
5. Confirm VPC endpoints are working correctly
6. Check that VPN connections work as expected
7. Verify that peering connections are established correctly

## References

- [AWS CDK VpcV2 API Reference](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.Vpc.html)
- [AWS CDK Migration Guide](https://docs.aws.amazon.com/cdk/v2/guide/migrating-v2.html)
- [VPC-V2 Base Class Documentation](https://github.com/aws/aws-cdk/blob/main/packages/%40aws-cdk/aws-ec2-alpha/lib/vpc-v2-base.ts)
