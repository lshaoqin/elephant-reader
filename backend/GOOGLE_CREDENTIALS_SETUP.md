# Google Application Default Credentials Setup

This guide explains how to set up Google Cloud credentials for the Flask backend to use Google Cloud Vision API.

## Prerequisites

- Google Cloud Project with Vision API enabled
- Service account with Vision API permissions

## Step 1: Create a Service Account (if not already done)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **IAM & Admin** > **Service Accounts**
4. Click **Create Service Account**
5. Fill in the details and click **Create and Continue**
6. Grant the following roles:
   - **Cloud Vision API User**
   - **Editor** (for other operations)
7. Click **Continue** and then **Done**

## Step 2: Create and Download Service Account Key

1. In the Service Accounts list, click on your service account
2. Go to the **Keys** tab
3. Click **Add Key** > **Create new key**
4. Choose **JSON** format
5. Click **Create** - the JSON file will download automatically

## Step 3: Add Credentials to Your Project

1. Create a `credentials` folder in the `backend/` directory:
   ```bash
   mkdir -p backend/credentials
   ```

2. Move or copy the downloaded JSON file to this location and rename it:
   ```bash
   mv ~/Downloads/your-service-account-key.json backend/credentials/google-credentials.json
   ```

3. **IMPORTANT**: Add credentials to `.gitignore` to prevent accidental commits:
   ```bash
   echo "credentials/" >> .gitignore
   ```

## Step 4: Verify the Setup

1. Make sure your `docker-compose.yml` has the credentials volume mount (it should already):
   ```yaml
   environment:
     - GOOGLE_APPLICATION_CREDENTIALS=/backend/credentials/google-credentials.json
   volumes:
     - ./credentials:/backend/credentials:ro
   ```

2. Start the containers:
   ```bash
   docker-compose up -d
   ```

3. Check if credentials are properly loaded by looking at logs:
   ```bash
   docker logs flask_tts_app
   ```

## Step 5: Test the Vision API

1. Upload an image through the app
2. If you see extracted text, the credentials are working!
3. Check logs for any authentication errors:
   ```bash
   docker logs flask_tts_app | grep -i "auth\|credential\|error"
   ```

## Troubleshooting

### "Permission denied" or "Credentials not found"
- Verify the file exists: `backend/credentials/google-credentials.json`
- Check file permissions: `ls -la backend/credentials/`
- Verify `GOOGLE_APPLICATION_CREDENTIALS` environment variable in docker-compose.yml

### "Invalid service account"
- Download a new key from Google Cloud Console
- Replace the old `google-credentials.json` file
- Restart containers: `docker-compose restart flask_tts_app`

### "Vision API not enabled"
- Go to [Google Cloud Console APIs](https://console.cloud.google.com/apis)
- Search for "Cloud Vision API"
- Click it and select "Enable"

### Container fails to start
- Check logs: `docker logs flask_tts_app`
- Ensure credentials file path is correct
- Ensure file has proper JSON format

## Security Notes

⚠️ **IMPORTANT**:
- **Never** commit credentials files to Git
- The `credentials/` folder is already in `.gitignore`
- Keep your service account key secure
- If key is compromised, regenerate it immediately
- Consider rotating keys regularly
- Use environment variables for other sensitive data

## Alternative: Using Environment Variables

If you prefer not to mount files, you can also pass credentials via environment variable (less secure for local development):

1. Base64 encode your JSON key:
   ```bash
   cat backend/credentials/google-credentials.json | base64
   ```

2. Add to `.env` (also in `.gitignore`):
   ```
   GOOGLE_CREDENTIALS_BASE64=<base64-encoded-json>
   ```

3. Modify the app to decode and use this variable instead.

## File Structure After Setup

```
backend/
├── credentials/              # Add to .gitignore
│   └── google-credentials.json
├── .gitignore
├── docker-compose.yml
├── Dockerfile
├── app.py
└── ...
```

## What This Enables

With credentials set up, your backend can:
- Extract text from images using Google Cloud Vision API
- Process documents with advanced OCR capabilities
- Extract text blocks with bounding box information
- Enable the full text extraction pipeline
