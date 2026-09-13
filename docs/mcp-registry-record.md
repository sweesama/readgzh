# Maintaining the official MCP Registry record

The root `server.json` contains the intended public listing for
`io.github.sweesama/readgzh`. Keep it versioned with the product documentation so
directory descriptions do not depend on an old one-off submission.

The 1.0.1 record removes unsupported extraction-success/compression percentages,
adds the website, and distinguishes optional API-key authentication from limited
anonymous use. This is a metadata version, not the deployed MCP software version.
The existing remote endpoint and repository remain unchanged.

The official `mcp-publisher validate server.json` command passed for this record
on 2026-09-13. Validation and merging this file do **not** publish it. At preparation
time, the live Registry still returned 1.0.0.

An authorized maintainer can use the official publisher's GitHub device login,
inspect its requested permissions, then publish the reviewed file:

```text
mcp-publisher login github
mcp-publisher publish server.json
```

Do not put credentials in this JSON or commit publisher authentication files.
After publishing, read the official latest record and verify its version,
description and remote header instructions. Downstream directories update on
their own schedules; an accepted Registry record does not guarantee their refresh
or a particular AI recommendation.

Official references:
- [Publisher quickstart](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/quickstart.mdx)
- [Publisher authentication](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/authentication.mdx)
