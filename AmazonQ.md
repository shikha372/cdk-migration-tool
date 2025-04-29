# AWS CDK Migration Tool MCP

## Overview

This Model Context Protocol (MCP) server provides specialized context to Amazon Q for assisting with AWS CDK migrations. It helps developers migrate between different versions of CDK constructs and patterns, ensuring smooth transitions as the CDK evolves.

## Features

- **Version Migration**: Assists with migrating between CDK v1 and CDK v2
- **Construct Upgrades**: Provides guidance on upgrading deprecated constructs to their modern equivalents
- **Pattern Transformation**: Helps transform legacy infrastructure patterns to current best practices
- **Code Analysis**: Analyzes existing CDK code to identify migration opportunities
- **Documentation References**: Links to relevant AWS documentation for migration scenarios

## Configuration

The MCP server is configured in your `.aws/amazonq/mcp.json` file and is set up to run as a local server that Amazon Q can communicate with.

## Usage

When interacting with Amazon Q, the MCP server provides additional context about CDK migration patterns, allowing for more accurate and helpful responses specific to CDK migration scenarios.

## Development

To extend the functionality of this MCP:

1. Modify the migration.js file to add new migration patterns
2. Update the server configuration as needed
3. Test with Amazon Q to ensure proper context is being provided

## Requirements

- Node.js
- AWS CDK knowledge
- Amazon Q CLI
