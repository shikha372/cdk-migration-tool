import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs/promises";
// Create MCP server for VPC migration
const server = new McpServer({
    name: "vpc-migration",
    description: "Server to assist with migrating AWS CDK VPC constructs from v1 to v2",
    version: "1.0.0",
});
// Resource to access CDK code files
server.resource("cdk-files", new ResourceTemplate("{filePath}", { list: undefined }), async (uri, { filePath }) => {
    try {
        // Ensure filePath is a string (not an array)
        const filePathStr = typeof filePath === 'string' ? filePath : String(filePath);
        const content = await fs.readFile(filePathStr, "utf8");
        return {
            contents: [{
                    uri: uri.href,
                    text: content
                }]
        };
    }
    catch (error) {
        return {
            contents: [{
                    uri: uri.href,
                    text: `Error reading file: ${error instanceof Error ? error.message : String(error)}`
                }]
        };
    }
});
// Resource to access migration guides
// server.resource(
//   "migration-guide",
//   new ResourceTemplate("https://github.com/shikha372/cdk-migration-tool/blob/main/README.md", { list: undefined }),
//   async (uri, { guideName }) => {
//     try {
//       // Ensure guideName is a string
//       const guideNameStr = typeof guideName === 'string' ? guideName : String(guideName);
//       const guidePath = path.join(process.cwd(), `${guideNameStr}.md`);
//       const content = await fs.readFile(guidePath, "utf8");
//       return {
//         contents: [{
//           uri: uri.href,
//           text: content
//         }]
//       };
//     } catch (error) {
//       return {
//         contents: [{
//           uri: uri.href,
//           text: `Error reading migration guide: ${error instanceof Error ? error.message : String(error)}`
//         }]
//       };
//     }
//   }
// );
// Tool to analyze CDK code for VPC constructs
server.tool("analyze-vpc", "Analyzes CDK code to identify VPC constructs and their configurations", {
    filePath: z.string().describe("Absolute Path to the CDK file to analyze")
}, async ({ filePath }) => {
    try {
        // Ensure filePath is a string
        const filePathStr = typeof filePath === 'string' ? filePath : '';
        // Log for debugging
        console.error(`Analyzing file: ${filePathStr}`);
        // Check if file exists
        try {
            await fs.access(filePathStr);
        }
        catch (err) {
            console.error(`File access error: ${err}`);
            return {
                content: [{
                        type: "text",
                        text: `Error: File does not exist or is not accessible: ${filePathStr}`
                    }],
                isError: true
            };
        }
        // Read file content
        const content = await fs.readFile(filePathStr, "utf8");
        console.error(`File content length: ${content.length} bytes`);
        // Create a prompt for AI analysis
        const analysisPrompt = `
      You are an expert AWS CDK code analyzer. Analyze the following TypeScript/JavaScript code and identify all VPC-related constructs and configurations.
      
      Focus on:
      1. VPC constructs (new ec2.Vpc or new Vpc)
      2. VPC imports (Vpc.fromVpcAttributes, Vpc.fromLookup)
      3. Subnet configurations (subnetConfiguration property)
      4. NAT Gateway configurations (natGateways property)
      5. CIDR block configurations (cidr or cidrMask properties)
      6. Availability Zone configurations (maxAzs property)
      7. VPN Gateway configurations (enableVpnGateway method)
      8. VPC Endpoint configurations (addGatewayEndpoint, addInterfaceEndpoint methods)
      
      For each VPC construct found, extract:
      - The construct ID/name
      - The complete configuration object
      - Line number or approximate position in the code
      
      Analyze the complexity of migration to VPC V2:
      - Simple: Basic VPC with minimal configuration
      - Moderate: VPC with multiple subnet types or moderate complexity
      - Complex: VPC with VPN gateways or many VPC endpoints
      
      Format your response as a JSON object with the following structure:
      {
        "vpcConstructs": number of VPC constructs found,
        "vpcImports": number of VPC imports found,
        "totalVpcReferences": total number of VPC references,
        "components": {
          "subnetConfigurations": count,
          "natGateways": count,
          "cidrBlocks": count,
          "maxAzs": count,
          "vpnGateways": count,
          "vpcEndpoints": count
        },
        "vpcConfigs": [
          {
            "constructId": "name of the construct",
            "configBlock": "complete configuration object as string",
            "position": approximate position in the code
          }
        ],
        "subnetAnalysis": [
          {
            "types": ["PUBLIC", "PRIVATE_WITH_NAT", etc.],
            "count": number of subnet configurations
          }
        ],
        "migrationComplexity": "Simple|Moderate|Complex",
        "migrationReady": boolean indicating if migration is possible
      }
      
      Here's the code to analyze:
      
      ${content}
      `;
        console.error(`Generated AI analysis prompt with length: ${analysisPrompt.length}`);
        // In a real implementation, this would call an AI service
        // For now, we'll return a placeholder result with the prompt
        // This is a placeholder for the actual AI service call
        // In a real implementation, you would send the prompt to an AI service
        // and process the response
        // Placeholder result - in a real implementation, this would come from the AI service
        const placeholderResult = {
            file: filePathStr,
            analysisMethod: "AI-based analysis",
            prompt: analysisPrompt.substring(0, 500) + "...", // Include part of the prompt for reference
            migrationGuide: "/Users/shikagg/migration_mcp/vpc-migration-guide.md",
            note: "This is a placeholder. In a real implementation, this would be replaced with the AI service response."
        };
        console.error(`Analysis complete: Prompt generated and ready for AI service`);
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify(placeholderResult, null, 2)
                }]
        };
    }
    catch (error) {
        console.error(`Error analyzing file: ${error instanceof Error ? error.message : String(error)}`);
        return {
            content: [{
                    type: "text",
                    text: `Error analyzing file: ${error instanceof Error ? error.message : String(error)}`
                }],
            isError: true
        };
    }
});
// Tool to get recommended migration approach for VPC constructs
server.tool("get-vpc-migration-recommendations", "Provides recommendations for migrating VPC constructs from CDK v1 to v2", {
    cdkCode: z.string().describe("CDK code snippet containing VPC construct")
}, async ({ cdkCode }) => {
    // Look for common VPC configuration patterns
    const hasSubnets = cdkCode.includes("subnet");
    const hasIpAddresses = cdkCode.includes("cidr") || cdkCode.includes("ipAddress");
    // Determine migration approach based on patterns
    const recommendations = [];
    if (hasSubnets) {
        recommendations.push("Subnet Configuration: define these subnet as new SubnetV2 with same availability zone, CIDR range and subnet type, pass in vpc as prop");
        recommendations.push("IPv4 CIDR block for subnet is defined using prop ipv4CidrBlock");
        recommendations.push("Ipv4 CIDR block to defined as new IpCidr(<ipaddress>)");
    }
    if (hasIpAddresses) {
        recommendations.push("IP Addressing: Migrate to property primaryAddressBlock: IpAddresses.ipv4(cidr)");
    }
    if (recommendations.length === 0) {
        recommendations.push("Basic VPC Migration: Use the updated VPC constructor with required parameters");
    }
    return {
        content: [{
                type: "text",
                text: JSON.stringify({
                    migrationApproaches: recommendations,
                    // guideReference: "See https://github.com/shikha372/cdk-migration-tool/blob/main/README.md for detailed migration steps"
                }, null, 2)
            }]
    };
});
// Tool to refactor VPC code
server.tool("refactor-vpc", "Refactors CDK v1 VPC code to use CDK v2 VPC constructs", {
    cdkCode: z.string().describe("Original CDK code with VPC construct"),
    migrationApproach: z.string().describe("Migration approach to apply")
}, async ({ cdkCode, migrationApproach }) => {
    try {
        // Read the migration guide for reference
        let migrationGuideContent = "";
        try {
            migrationGuideContent = await fs.readFile("/Users/shikagg/migration_mcp/vpc-migration-guide.md", "utf8");
            console.error("Migration guide loaded successfully");
        }
        catch (guideErr) {
            console.error(`Error loading migration guide: ${guideErr}`);
            migrationGuideContent = "Migration guide not available";
        }
        // Create a prompt for AI-based refactoring
        const refactorPrompt = `
      You are an expert AWS CDK developer specializing in migrating VPC constructs from CDK v1 to CDK v2.
      
      Your task is to refactor the following CDK v1 code to use the new VPC v2 constructs.
      
      Migration approach to apply: ${migrationApproach}
      
      Here's the original code:
      
      \`\`\`typescript
      ${cdkCode}
      \`\`\`
      
      Here's the migration guide for reference:
      
      ${migrationGuideContent}
      
      Key migration rules:
      1. Replace 'new ec2.Vpc' with 'new VpcV2'
      2. Replace 'cidr' property with 'primaryAddressBlock: IpAddresses.ipv4()'
      3. Replace 'subnetConfiguration' array with explicit SubnetV2 constructs
      4. Replace 'natGateways' property with vpc.addNatGateway() method calls
      5. Add explicit route tables and associate them with subnets
      6. Add explicit internet gateway with vpc.addInternetGateway() for public subnets
      7. Update import statements to include VpcV2, SubnetV2, IpAddresses, etc. from '@aws-cdk/aws-ec2-alpha'
      8. Maintain the same logical structure and functionality as the original code
      
      Please provide the complete refactored code, including all necessary import statements and maintaining the same variable names and structure where possible.
      
      Return ONLY the refactored code without explanations or comments about the changes.
      `;
        console.error(`Generated AI refactoring prompt with length: ${refactorPrompt.length}`);
        // In a real implementation, this would call an AI service
        // For now, we'll return a placeholder result
        // This is a placeholder for the actual AI service call
        // In a real implementation, you would send the prompt to an AI service
        // and return the refactored code from the response
        // For demonstration purposes, we'll return a simple transformation
        // that shows the structure of what the AI would return
        let placeholderRefactoredCode = cdkCode;
        // Add import statements
        if (!placeholderRefactoredCode.includes('@aws-cdk/aws-ec2-alpha')) {
            placeholderRefactoredCode = `import { VpcV2, SubnetV2, IpAddresses, IpCidr, RouteTable } from '@aws-cdk/aws-ec2-alpha';\n\n${placeholderRefactoredCode}`;
        }
        // Add placeholder comment to indicate this is a placeholder
        placeholderRefactoredCode = `// This is a placeholder for the AI-refactored code\n// In a real implementation, this would be replaced with the AI service response\n\n${placeholderRefactoredCode}`;
        console.error(`Refactoring complete: Prompt generated and ready for AI service`);
        return {
            content: [{
                    type: "text",
                    text: placeholderRefactoredCode
                }]
        };
    }
    catch (error) {
        console.error(`Error refactoring code: ${error instanceof Error ? error.message : String(error)}`);
        return {
            content: [{
                    type: "text",
                    text: `Error refactoring code: ${error instanceof Error ? error.message : String(error)}`
                }],
            isError: true
        };
    }
});
// Tool to validate VPC migration
server.tool("validate-vpc-migration", "Validates the correctness of a VPC migration from CDK v1 to v2", {
    originalCode: z.string().describe("Original CDK code with VPC construct"),
    migratedCode: z.string().describe("Migrated CDK code with VpcV2 construct")
}, async ({ originalCode, migratedCode }) => {
    // Check for common migration issues
    const validationResults = [];
    // Check if VpcV2 is being used
    if (!migratedCode.includes("VpcV2")) {
        validationResults.push({
            issue: "Missing VpcV2 construct",
            severity: "Error",
            recommendation: "Replace Vpc with VpcV2 from @aws-cdk/aws-ec2-alpha"
        });
    }
    // Check for proper IP addressing
    if (originalCode.includes("cidrMask") && !migratedCode.includes("primaryAddressBlock")) {
        validationResults.push({
            issue: "IP addressing not properly migrated",
            severity: "Error",
            recommendation: "Use primaryAddressBlock: IpAddresses.ipv4() instead of cidrMask"
        });
    }
    // Check for subnet migration
    if (originalCode.includes("subnetConfiguration") && !migratedCode.includes("SubnetV2")) {
        validationResults.push({
            issue: "Subnet configuration not properly migrated",
            severity: "Warning",
            recommendation: "Use SubnetV2 constructs instead of subnetConfiguration array"
        });
    }
    // Check for NAT gateway configuration
    if (originalCode.includes("natGateways") && !migratedCode.includes("addNatGateway")) {
        validationResults.push({
            issue: "NAT gateway configuration not properly migrated",
            severity: "Warning",
            recommendation: "Use vpc.addNatGateway() method instead of natGateways property"
        });
    }
    // Overall validation status
    const status = validationResults.length === 0 ? "PASS" : "FAIL";
    return {
        content: [{
                type: "text",
                text: JSON.stringify({
                    status,
                    issues: validationResults,
                    recommendations: validationResults.length === 0 ?
                        ["Migration successful! Test your infrastructure code to ensure it works as expected."] :
                        validationResults.map(r => r.recommendation)
                }, null, 2)
            }]
    };
});
// Tool to generate migration documentation
server.tool("generate-migration-docs", "Generates documentation for a VPC migration from CDK v1 to v2", {
    originalCode: z.string().describe("Original CDK code with VPC construct"),
    migratedCode: z.string().describe("Migrated CDK code with VpcV2 construct")
}, async ({ originalCode, migratedCode }) => {
    // Extract key changes between original and migrated code
    const changes = [];
    if (originalCode.includes("Vpc") && migratedCode.includes("VpcV2")) {
        changes.push("Upgraded from Vpc to VpcV2 construct");
    }
    if (originalCode.includes("cidrMask") && migratedCode.includes("primaryAddressBlock")) {
        changes.push("Migrated CIDR configuration to use primaryAddressBlock");
    }
    if (originalCode.includes("subnetConfiguration") && migratedCode.includes("SubnetV2")) {
        changes.push("Replaced subnetConfiguration array with explicit SubnetV2 constructs");
    }
    if (originalCode.includes("natGateways") && migratedCode.includes("addNatGateway")) {
        changes.push("Replaced natGateways property with addNatGateway() method calls");
    }
    // Generate markdown documentation
    const documentation = `
# VPC Migration Documentation

## Changes Applied

${changes.map(change => `- ${change}`).join('\n')}

## Migration Details

### Original Code
\`\`\`typescript
${originalCode}
\`\`\`

### Migrated Code
\`\`\`typescript
${migratedCode}
\`\`\`

## Testing Recommendations

1. Deploy the migrated infrastructure to a test environment
2. Verify network connectivity between subnets
3. Validate that internet connectivity works as expected
4. Check that any resources depending on the VPC can still connect properly

## References

- [AWS CDK VpcV2 API Reference](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.Vpc.html)
- [AWS CDK Migration Guide](https://docs.aws.amazon.com/cdk/v2/guide/migrating-v2.html)
`;
    return {
        content: [{
                type: "text",
                text: documentation
            }]
    };
});
// Start the server with stdio transport for command-line usage
// const startServer = async () => {
//   try {
//     console.error("Starting VPC Migration MCP server...");
//     const transport = new StdioServerTransport();
//     await server.connect(transport);
//   } catch (error) {
//     console.error("Error starting server:", error);
//     process.exit(1);
//   }
// };
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Migration MCP Server running on stdio");
}
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
// Execute the server if this is the main module
// if (import.meta.url === new URL(import.meta.url).href) {
//   startServer();
// }
export { server };
