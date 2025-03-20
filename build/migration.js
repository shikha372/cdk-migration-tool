import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs/promises";
// Create MCP server for VPC migration
const server = new McpServer({
    name: "vpc-migration",
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
server.tool("analyze-vpc", {
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
        // Simple regex pattern to detect VPC constructs
        const vpcPattern = /new\s+(?:ec2\.)?Vpc\s*\(/g;
        const vpcMatches = content.match(vpcPattern) || [];
        // Count VPC occurrences
        const vpcCount = vpcMatches.length;
        console.error(`Found ${vpcCount} VPC constructs`);
        // Extract VPC configuration
        let vpcConfig = null;
        if (vpcCount > 0) {
            // Attempt to extract the VPC configuration
            try {
                const fullVpcPattern = /new\s+(?:ec2\.)?Vpc\s*\([^{]*({\s*[\s\S]*?}\s*)\)/;
                const configMatch = content.match(fullVpcPattern);
                if (configMatch && configMatch[1]) {
                    vpcConfig = configMatch[1].trim();
                    console.error(`Extracted VPC config: ${vpcConfig.substring(0, 50)}...`);
                }
            }
            catch (extractErr) {
                console.error(`Error extracting VPC config: ${extractErr}`);
            }
        }
        const result = {
            file: filePathStr,
            vpcConstructs: vpcCount,
            matches: vpcMatches,
            config: vpcConfig,
            migrationReady: vpcCount > 0
        };
        console.error(`Analysis complete: ${JSON.stringify(result)}`);
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify(result, null, 2)
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
server.tool("get-vpc-migration-recommendations", {
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
server.tool("refactor-vpc", {
    cdkCode: z.string().describe("Original CDK code with VPC construct"),
    migrationApproach: z.string().describe("Migration approach to apply")
}, async ({ cdkCode, migrationApproach }) => {
    let refactoredCode = cdkCode;
    // Apply different refactoring strategies based on the migration approach
    if (migrationApproach.includes("Subnet")) {
        // Example subnet refactoring
        refactoredCode = refactoredCode.replace(/subnetConfiguration:\s*\[([^\]]+)\]/g, "new SubnetV2([$1])");
    }
    if (migrationApproach.includes("cidr")) {
        // Example IP addressing refactoring
        refactoredCode = refactoredCode.replace("ipAddresses: IpAddresses.cidr('$1')", "primaryAddressBlock:  IpAddresses.ipv4('$1')");
    }
    if (migrationApproach.includes("IPAM")) {
        refactoredCode = refactoredCode.replace("ipAddresses: IpAddresses.awsIpamAllocation('$1')", "primaryAddressBlock: Ip4Addresses.ipv4Ipam('$1')");
    }
    // Add import statements for new constructs if not already present
    const requiredImports = [
        "import { VpcV2, SubnetV2, IpAddresses } from '@aws-cdk/aws-ec2-alpha';"
    ];
    const importSection = requiredImports.join('\n');
    // Add imports if not already present
    if (!refactoredCode.includes("SubnetConfiguration") ||
        !refactoredCode.includes("IpAddresses") ||
        !refactoredCode.includes("Ipam")) {
        refactoredCode = importSection + '\n\n' + refactoredCode;
    }
    return {
        content: [{
                type: "text",
                text: refactoredCode
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
