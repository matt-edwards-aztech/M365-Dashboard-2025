# Microsoft 365 Service Health Dashboard

An interactive web dashboard that displays real-time service health information from the Microsoft 365 message center using the Microsoft Graph API.

## Features

- **Real-time Status Display**: Shows green indicators for healthy services and red for services with issues
- **Automatic Refresh**: Updates service status every 5 minutes (configurable)
- **Interactive Dashboard**: Clean, responsive design with service cards showing detailed status information
- **Issue Details**: Displays active issues and their descriptions for affected services
- **Secure Authentication**: Uses Microsoft MSAL for secure Azure AD authentication

## Prerequisites

- An Azure AD tenant with administrative access
- An Azure AD App Registration with appropriate permissions
- A web server to host the application (local or cloud-based)

## Setup Instructions

### 1. Create Azure AD App Registration

1. Go to the [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**
4. Configure the application:
   - **Name**: `M365 Service Health Dashboard`
   - **Supported account types**: `Accounts in this organizational directory only`
   - **Redirect URI**: `Single-page application (SPA)` - `http://localhost:8080` (or your domain)
5. Click **Register**

### 2. Configure API Permissions

1. In your app registration, go to **API permissions**
2. Click **Add a permission**
3. Select **Microsoft Graph**
4. Choose **Delegated permissions**
5. Add the following permissions:
   - `ServiceHealth.Read.All`
   - `ServiceMessage.Read.All` (optional, for message center data)
6. Click **Grant admin consent** for your organization

### 3. Configure the Application

1. Copy your **Application (client) ID** from the app registration overview
2. Copy your **Directory (tenant) ID** from the app registration overview
3. Open `script.js` and update the configuration:

```javascript
const msalConfig = {
    auth: {
        clientId: 'YOUR_CLIENT_ID', // Replace with your Application (client) ID
        authority: 'https://login.microsoftonline.com/YOUR_TENANT_ID', // Replace with your Directory (tenant) ID
        redirectUri: window.location.origin
    },
    // ... rest of config
};
```

### 4. Deploy the Application

#### Option A: Local Development Server
```bash
# Using Python (if installed)
python -m http.server 8080

# Using Node.js (if installed)
npx serve -s . -l 8080

# Using PHP (if installed)
php -S localhost:8080
```

#### Option B: Web Server
Upload all files to your web server and ensure the redirect URI in Azure AD matches your domain.

## Usage

1. Open the application in your web browser
2. You'll be prompted to sign in with your Microsoft 365 admin account
3. Grant consent for the required permissions
4. The dashboard will load and display the current service health status
5. Services with issues will show red indicators with details about active issues
6. The dashboard automatically refreshes every 5 minutes

## File Structure

```
M365ServiceIssues/
├── index.html          # Main HTML structure
├── styles.css          # Dashboard styling
├── script.js           # JavaScript application logic
└── README.md           # This documentation
```

## Service Status Indicators

- 🟢 **Green**: Service Operational - No known issues
- 🔴 **Red**: Service Interruption/Degradation - Active issues affecting service
- 🟡 **Yellow**: Advisory Issue - Minor issues or maintenance notices
- ⚫ **Gray**: Status Unknown - Unable to determine service status

## Permissions Required

The application requires the following Microsoft Graph permissions:

- **ServiceHealth.Read.All**: Read service health information for your organization
- **ServiceMessage.Read.All**: Read service messages and announcements (optional)

## Browser Support

This application uses modern JavaScript features and requires a recent web browser:
- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

## Troubleshooting

### Authentication Issues
- Ensure your Azure AD app registration is configured correctly
- Verify the client ID and tenant ID in `script.js`
- Check that the redirect URI matches your hosting URL
- Confirm admin consent has been granted for the required permissions

### Permission Errors
- Verify you have the necessary admin role in your Microsoft 365 tenant
- Check that ServiceHealth.Read.All permission is granted and consented
- Ensure you're signing in with an account that has admin privileges

### CORS Issues
- Host the application on a web server rather than opening the HTML file directly
- Ensure your redirect URI in Azure AD matches your hosting URL exactly

## Security Considerations

- The application uses MSAL for secure token handling
- Access tokens are stored in localStorage and automatically refreshed
- No service health data is stored permanently - all data is fetched in real-time
- Admin consent is required, limiting access to authorized users only

## Contributing

To extend this application:
1. Additional service details can be retrieved from other Graph API endpoints
2. Historical data can be displayed by calling the issues endpoint with date filters
3. Notifications can be added for new service issues
4. Export functionality can be implemented for service health reports

## License

This project is provided as-is for educational and demonstration purposes.