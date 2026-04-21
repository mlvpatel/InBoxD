# Cloud Setup
last_updated: 2026-04-21

This document provides the complete setup procedure for the cloud variant of the Email Classifier.

## Prerequisites

1. Docker Desktop installed and running.
2. An ngrok account with a reserved domain (for webhook URL).
3. A Microsoft account with access to Outlook and OneDrive.
4. An OpenAI account with API key access.

## Step 1: Install Docker Desktop

1. Download Docker Desktop from https://www.docker.com/products/docker-desktop/.
2. Install and launch the application.
3. Verify the installation by running `docker --version` in a terminal.

## Step 2: Configure ngrok Reserved Domain

1. Sign up or log in at https://dashboard.ngrok.com/.
2. Navigate to Cloud Edge, then Domains.
3. Create a new reserved domain (e.g., `email-classifier.ngrok-free.app`).
4. Note the domain name for use as the N8N_WEBHOOK_URL.
5. Start ngrok with `ngrok http --domain=YOUR_DOMAIN 5678`.

## Step 3: Azure Entra ID App Registration

This step configures OAuth2 access for Outlook and OneDrive.

### 3a: Choose Tenant Type

There are two options depending on the Microsoft account type.

| Account Type | Tenant Configuration | Supported Account Types Setting |
|---|---|---|
| Work or School (Organizational) | Use the default organizational tenant | Accounts in this organizational directory only |
| Personal (Outlook.com, Hotmail) | Use the "Consumers" tenant or select "Personal Microsoft accounts only" | Personal Microsoft accounts only |

For most demonstrations, select "Personal Microsoft accounts only" or "Accounts in any organizational directory and personal Microsoft accounts" to support both account types.

### 3b: Register the Application

1. Navigate to https://portal.azure.com/.
2. Go to Azure Active Directory (or Microsoft Entra ID), then App registrations.
3. Click New registration.
4. Set the name to "Email Classifier" (or any descriptive name).
5. Set the supported account types per the table above.
6. Set the redirect URI to `https://YOUR_N8N_DOMAIN/rest/oauth2-credential/callback` (Web platform).
7. Click Register.
8. Note the Application (client) ID. This is the MICROSOFT_CLIENT_ID.
9. Note the Directory (tenant) ID. This is the MICROSOFT_TENANT_ID.

### 3c: Create Client Secret

1. In the app registration, go to Certificates and secrets.
2. Click New client secret.
3. Set a description (e.g., "n8n credential") and expiration period.
4. Click Add.
5. **Important**: Copy the **Value** column immediately. This is the MICROSOFT_CLIENT_SECRET. The **Secret ID** column is NOT the secret value. The value is only shown once.

### 3d: Configure API Permissions

1. Go to API permissions.
2. Click Add a permission, then Microsoft Graph, then Delegated permissions.
3. Add the following permissions:
   1. Mail.ReadWrite
   2. Mail.Send
   3. Files.Read.All (for OneDrive Excel access)
   4. User.Read
4. Click Grant admin consent (if available for organizational accounts).

<!-- Placeholder: Screenshot of API permissions configuration -->

## Step 4: Upload Excel Database

1. Open OneDrive at https://onedrive.live.com/.
2. Upload the files `data/Inventory.xlsx` and `data/Deliveries.xlsx` to a known location.
3. Note the path or item ID for the ONEDRIVE_EXCEL_PATH environment variable.
4. The path format depends on the n8n Microsoft Excel node version. Typically this is the workbook name or path relative to the OneDrive root.

## Step 5: Configure Environment Variables

1. Copy `.env.example` to `.env`.
2. Fill in the following values:

| Variable | Value |
|---|---|
| N8N_BASIC_AUTH_USER | Choose an admin username |
| N8N_BASIC_AUTH_PASSWORD | Choose a strong password |
| N8N_WEBHOOK_URL | Your ngrok reserved domain URL |
| N8N_ENCRYPTION_KEY | A random string for credential encryption |
| MICROSOFT_CLIENT_ID | From Step 3b |
| MICROSOFT_CLIENT_SECRET | The secret **Value** from Step 3c |
| MICROSOFT_TENANT_ID | From Step 3b |
| OPENAI_API_KEY | From the OpenAI dashboard |
| ONEDRIVE_EXCEL_PATH | From Step 4 |

## Step 6: Start n8n

1. Navigate to the `docker/` directory.
2. Run `docker compose -f docker-compose.cloud.yml up -d`.
3. Open http://localhost:5678 in a browser.
4. Log in with the credentials from Step 5.

## Step 7: Create n8n Credentials

### 7a: Microsoft Outlook OAuth2

1. In n8n, go to Settings, then Credentials.
2. Click Add Credential, search for "Microsoft Outlook OAuth2 API".
3. Enter the Client ID (MICROSOFT_CLIENT_ID).
4. Enter the Client Secret (MICROSOFT_CLIENT_SECRET, the **Value** not the ID).
5. Click Connect, and complete the OAuth2 flow in the popup window.
6. Name the credential "Outlook account".

### 7b: Microsoft Excel OAuth2

1. Add another credential for "Microsoft Excel OAuth2 API".
2. Use the same Client ID and Client Secret.
3. Complete the OAuth2 flow.
4. Name the credential "Microsoft Excel account".

### 7c: OpenAI API

1. Add a credential for "OpenAI API".
2. Enter the API key from the OpenAI dashboard.
3. Name the credential "OpenAI account".

<!-- Placeholder: Screenshot of n8n credentials page -->

## Step 8: Import and Activate the Workflow

1. In n8n, go to Workflows.
2. Click the menu icon and select "Import from File".
3. Select `workflows/cloud/workflow.json`.
4. Verify that all nodes show the correct credentials.
5. Activate the workflow using the toggle in the top right corner.

## Step 9: Test the Workflow

1. Send a test email to the monitored Outlook inbox with a subject like "Price of TechPro Laptop 303X".
2. Wait for the polling interval (up to one minute).
3. Check the Outlook Drafts folder for the generated reply.
4. Review the n8n execution log for the structured log entry.

<!-- Placeholder: Screenshot of successful execution -->

## Troubleshooting

| Issue | Resolution |
|---|---|
| OAuth2 callback fails | Verify the redirect URI in Azure matches the n8n domain exactly |
| Excel node returns empty | Verify the ONEDRIVE_EXCEL_PATH and that File.Read.All permission is granted |
| Workflow does not trigger | Verify the Outlook Trigger node credentials and polling interval |
| Draft not created | Check that Mail.ReadWrite permission is granted and the credential is connected |
