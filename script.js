console.log('script.js is loading...');

// Microsoft Graph API configuration
const msalConfig = {
    auth: {
        clientId: 'e503fd40-c85f-42dd-b4f8-50b741d17f98', // Azure App Registration Client ID
        authority: 'https://login.microsoftonline.com/c552e89b-6b33-4841-aa8d-7228626dbe17', // Northpoint Capital Management tenant ID
        redirectUri: window.location.hostname === 'localhost' ? 'http://localhost:8080' : 'https://lively-island-0775fa403.2.azurestaticapps.net'
    },
    cache: {
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: false
    }
};

const loginRequest = {
    scopes: ['ServiceHealth.Read.All']
};

class M365ServiceHealthDashboard {
    constructor() {
        this.msalInstance = new msal.PublicClientApplication(msalConfig);
        this.account = null;
        this.refreshInterval = null;
        this.init();
    }

    async init() {
        try {
            console.log('=== DASHBOARD INITIALIZATION DEBUG ===');
            await this.msalInstance.initialize();
            console.log('MSAL initialized successfully');
            
            this.account = this.msalInstance.getActiveAccount();
            console.log('Active account found:', !!this.account);
            
            if (!this.account) {
                const accounts = this.msalInstance.getAllAccounts();
                console.log('All accounts found:', accounts.length);
                if (accounts.length > 0) {
                    this.account = accounts[0];
                    this.msalInstance.setActiveAccount(this.account);
                    console.log('Set active account');
                }
            }

            this.setupEventListeners();
            
            if (this.account) {
                console.log('Account available, loading service health...');
                this.loadServiceHealth();
            } else {
                console.log('No account, showing login required...');
                this.showLoginRequired();
            }
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to initialize authentication', error.message);
        }
    }

    setupEventListeners() {
        const refreshBtn = document.getElementById('refreshBtn');
        const autoRefreshCheckbox = document.getElementById('autoRefresh');
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        const displayModeSelect = document.getElementById('displayMode');

        refreshBtn.addEventListener('click', () => {
            this.loadServiceHealth();
        });

        const forceRefreshBtn = document.getElementById('forceRefreshBtn');
        if (forceRefreshBtn) {
            forceRefreshBtn.addEventListener('click', () => {
                // Clear any browser cache for this data
                localStorage.clear();
                sessionStorage.clear();
                
                // Force reload the entire page to get fresh JavaScript
                window.location.reload(true);
            });
        }

        autoRefreshCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.startAutoRefresh();
            } else {
                this.stopAutoRefresh();
            }
        });

        fullscreenBtn.addEventListener('click', () => {
            this.toggleFullscreen();
        });

        // Add test modal button
        console.log('Looking for testModalBtn...');
        const testModalBtn = document.getElementById('testModalBtn');
        console.log('testModalBtn found:', testModalBtn);
        
        if (testModalBtn) {
            console.log('Adding click listener to test modal button');
            testModalBtn.addEventListener('click', (e) => {
                console.log('Test modal button clicked');
                e.preventDefault();
                alert('Test modal button works!');
                try {
                    this.showServiceModal({service: 'Test Service', status: 'serviceOperational'}, [
                        {title: 'Test Issue', status: 'investigating', classification: 'Advisory'}
                    ]);
                } catch (error) {
                    console.error('Error in test modal:', error);
                }
            });
        } else {
            console.error('testModalBtn not found!');
        }

        displayModeSelect.addEventListener('change', (e) => {
            this.setDisplayMode(e.target.value);
        });

        // Handle fullscreen change events
        document.addEventListener('fullscreenchange', () => {
            const isFullscreen = document.fullscreenElement !== null;
            fullscreenBtn.textContent = isFullscreen ? 'Exit Full Screen' : 'Full Screen';
        });

        // Start auto-refresh by default
        if (autoRefreshCheckbox.checked) {
            this.startAutoRefresh();
        }

        // Load saved display mode
        const savedMode = localStorage.getItem('displayMode') || 'standard';
        displayModeSelect.value = savedMode;
        this.setDisplayMode(savedMode);

        // Add keyboard shortcut to exit kiosk mode (Escape key)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.body.classList.contains('kiosk-mode')) {
                this.exitKioskMode();
            }
            // Nuclear option: Ctrl+Shift+Escape to force exit and reload
            if (e.key === 'Escape' && e.ctrlKey && e.shiftKey) {
                localStorage.setItem('displayMode', 'standard');
                window.location.reload();
            }
        });

        // Make logo clickable in kiosk mode to return to standard
        const logo = document.querySelector('.company-logo');
        logo.addEventListener('click', () => {
            if (document.body.classList.contains('kiosk-mode')) {
                this.exitKioskMode();
            }
        });
    }

    async login() {
        try {
            const loginResponse = await this.msalInstance.loginPopup(loginRequest);
            this.account = loginResponse.account;
            this.msalInstance.setActiveAccount(this.account);
            this.loadServiceHealth();
        } catch (error) {
            console.error('Login error:', error);
            this.showError('Login failed', error.message);
        }
    }

    async getAccessToken() {
        console.log('=== GET ACCESS TOKEN DEBUG ===');
        console.log('Account check:', !!this.account);
        
        if (!this.account) {
            console.error('No account found in getAccessToken');
            throw new Error('No account found. Please login first.');
        }

        try {
            console.log('Attempting silent token acquisition...');
            console.log('Login request scopes:', loginRequest.scopes);
            console.log('Account username:', this.account.username);
            
            const response = await this.msalInstance.acquireTokenSilent({
                ...loginRequest,
                account: this.account
            });
            
            console.log('Silent token acquisition successful');
            console.log('Token received:', !!response.accessToken);
            return response.accessToken;
            
        } catch (error) {
            console.log('Silent token acquisition failed:', error.message);
            console.log('Error type:', error.constructor.name);
            
            if (error instanceof msal.InteractionRequiredAuthError) {
                console.log('Interaction required, attempting popup...');
                const response = await this.msalInstance.acquireTokenPopup(loginRequest);
                console.log('Popup token acquisition successful');
                return response.accessToken;
            }
            
            console.error('Token acquisition failed with non-interaction error:', error);
            throw error;
        }
    }

    async loadServiceHealth() {
        console.log('=== LOAD SERVICE HEALTH DEBUG ===');
        console.log('Function called at:', new Date().toISOString());
        
        const loadingElement = document.getElementById('loading');
        const servicesGrid = document.getElementById('servicesGrid');
        const errorMessage = document.getElementById('errorMessage');
        const refreshBtn = document.getElementById('refreshBtn');

        try {
            console.log('1. Setting up UI...');
            loadingElement.style.display = 'block';
            servicesGrid.innerHTML = '';
            errorMessage.style.display = 'none';
            refreshBtn.disabled = true;
            console.log('   UI setup complete');

            console.log('2. Checking account...');
            console.log('   this.account:', this.account);
            console.log('   Account exists:', !!this.account);
            
            if (!this.account) {
                console.log('   No account found, attempting login...');
                await this.login();
                console.log('   Login completed, returning...');
                return;
            }

            console.log('3. Getting access token...');
            console.log('   About to call getAccessToken()');
            const accessToken = await this.getAccessToken();
            console.log('   Access token obtained successfully:', !!accessToken);
            console.log('   Token length:', accessToken ? accessToken.length : 'N/A');
            
            // Fetch service health data
            console.log('4. Fetching service health data...');
            console.log('   About to call fetchServiceHealth()');
            const healthData = await this.fetchServiceHealth(accessToken);
            console.log('   Service health data received successfully');
            console.log('   Services count:', healthData.services ? healthData.services.length : 'N/A');
            console.log('   Issues count:', healthData.issues ? healthData.issues.length : 'N/A');
            
            // Display the data
            console.log('5. Displaying service health data...');
            console.log('   About to call displayServiceHealth()');
            this.displayServiceHealth(healthData);
            console.log('   Display completed');
            
            console.log('6. Updating last updated time...');
            this.updateLastUpdatedTime();
            console.log('   Last updated time set');
            
            console.log('=== LOAD SERVICE HEALTH COMPLETED SUCCESSFULLY ===');

        } catch (error) {
            console.error('=== ERROR IN LOAD SERVICE HEALTH ===');
            console.error('Error at step:', error.step || 'unknown');
            console.error('Error details:', error);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            this.showError('Failed to load service health data', error.message);
        } finally {
            console.log('7. Cleanup - hiding loading and enabling refresh button');
            loadingElement.style.display = 'none';
            refreshBtn.disabled = false;
            console.log('   Cleanup completed');
        }
    }

    async fetchServiceHealth(accessToken) {
        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        };

        // Add cache-busting timestamp to force fresh API calls
        const timestamp = new Date().getTime();

        // Fetch service health overview
        const healthResponse = await fetch(`https://graph.microsoft.com/v1.0/admin/serviceAnnouncement/healthOverviews?_=${timestamp}`, {
            headers: headers,
            cache: 'no-cache'
        });

        if (!healthResponse.ok) {
            throw new Error(`HTTP ${healthResponse.status}: ${healthResponse.statusText}`);
        }

        const healthData = await healthResponse.json();

        // Fetch current issues for each service
        const issuesResponse = await fetch(`https://graph.microsoft.com/v1.0/admin/serviceAnnouncement/issues?_=${timestamp}`, {
            headers: headers,
            cache: 'no-cache'
        });

        let issuesData = { value: [] };
        if (issuesResponse.ok) {
            issuesData = await issuesResponse.json();
        }

        // Optional: Log summary for debugging (can be removed in production)
        // console.log(`Loaded ${healthData.value?.length || 0} services and ${issuesData.value?.length || 0} issues`);

        // Combine health overview with issues data
        return {
            services: healthData.value || [],
            issues: issuesData.value || []
        };
    }

    displayServiceHealth(data) {
        const servicesGrid = document.getElementById('servicesGrid');
        servicesGrid.innerHTML = '';

        if (!data.services || data.services.length === 0) {
            servicesGrid.innerHTML = '<p>No service health data available.</p>';
            return;
        }

        // Group issues by service
        const issuesByService = {};
        data.issues.forEach(issue => {
            if (!issuesByService[issue.service]) {
                issuesByService[issue.service] = [];
            }
            issuesByService[issue.service].push(issue);
        });

        // Sort services by priority: Issues first, then degradation, then healthy
        const sortedServices = data.services.sort((a, b) => {
            const priorityA = this.getStatusPriority(a.status, issuesByService[a.service] || []);
            const priorityB = this.getStatusPriority(b.status, issuesByService[b.service] || []);
            
            // Lower priority number = higher importance (shown first)
            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }
            
            // If same priority, sort alphabetically by service name
            return a.service.localeCompare(b.service);
        });

        sortedServices.forEach(service => {
            const serviceCard = this.createServiceCard(service, issuesByService[service.service] || []);
            servicesGrid.appendChild(serviceCard);
        });
    }

    createServiceCard(service, issues) {
        const card = document.createElement('div');
        
        // Determine if we need to override status for cards with operational status but active issues
        let displayStatus = service.status;
        let displayClass = this.getStatusClass(service.status);
        

        // Separate different types of issues - Let's be more specific about what constitutes critical vs advisory
        const criticalIssues = issues.filter(issue => {
            const hasIncidentStatus = issue.status === 'investigating' || 
                                    issue.status === 'serviceDegradation' ||
                                    issue.status === 'serviceInterruption';
            
            // Don't treat as critical if explicitly classified as advisory
            const isExplicitlyAdvisory = issue.classification?.toLowerCase() === 'advisory';
            
            return hasIncidentStatus && !isExplicitlyAdvisory;
        });

        const advisoryIssues = issues.filter(issue => {
            // Check if it's explicitly marked as advisory (case insensitive)
            const isAdvisory = issue.classification?.toLowerCase() === 'advisory' || 
                              issue.title?.toLowerCase().includes('advisory') ||
                              issue.impactDescription?.toLowerCase().includes('advisory');
            
            // Include advisories from the last 30 days, even if resolved
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const issueDate = new Date(issue.lastModifiedDateTime || issue.startDateTime);
            const isRecent = issueDate >= thirtyDaysAgo;
            
            // Show advisory if it's currently active (not resolved and not restored)
            const isActive = !issue.isResolved && 
                           issue.status !== 'serviceRestored' && 
                           issue.status !== 'serviceOperational';
            
            // For resolved issues, only show if they're very recent (last 1 day)
            const oneDayAgo = new Date();
            oneDayAgo.setDate(oneDayAgo.getDate() - 1);
            const isVeryRecent = issueDate >= oneDayAgo;
            
            const isActiveOrRecent = isActive || (issue.isResolved && isVeryRecent);
            
            
            return isAdvisory && isActiveOrRecent;
        });

        // Determine display status based on actual active issues AND service status
        if (criticalIssues.length > 0) {
            // Has active critical issues - keep original status or show as issues
            // displayStatus stays as service.status
            // displayClass stays as this.getStatusClass(service.status)
        } else if (advisoryIssues.length > 0) {
            // No critical issues but has active advisory issues - show as advisory
            displayStatus = 'advisoryissue';
            displayClass = 'advisory';
        } else if (service.status === 'serviceDegradation' || service.status === 'extendedRecovery') {
            // Production solution: Use service status as authoritative source when Graph API issues are unavailable
            // This handles cases where M365 Admin Center shows advisories but Graph API /issues endpoint doesn't
            displayStatus = 'advisoryissue';
            displayClass = 'advisory';
        } else {
            // No active critical or advisory issues and status is operational - show as operational
            displayStatus = 'serviceoperational';
            displayClass = 'healthy';
        }


        card.className = `service-card ${displayClass} clickable`;
        card.style.cursor = 'pointer';

        card.innerHTML = `
            <div class="service-header">
                <div class="service-name">${service.service}</div>
                <div class="status-indicator ${displayClass}">
                    ${this.getStatusIcon(displayStatus)}
                </div>
            </div>
            <div class="service-status ${displayClass}">
                ${this.getStatusText(displayStatus)}
            </div>
            ${criticalIssues.length > 0 || advisoryIssues.length > 0 || (service.status === 'serviceDegradation' || service.status === 'extendedRecovery') ? `
                <div class="issues-count">
                    ${criticalIssues.length > 0 ? `${criticalIssues.length} active issue${criticalIssues.length !== 1 ? 's' : ''}` : ''}
                    ${criticalIssues.length > 0 && advisoryIssues.length > 0 ? ', ' : ''}
                    ${advisoryIssues.length > 0 ? `${advisoryIssues.length} advisory${advisoryIssues.length !== 1 ? ' items' : ' item'}` : ''}
                    ${(criticalIssues.length === 0 && advisoryIssues.length === 0 && (service.status === 'serviceDegradation' || service.status === 'extendedRecovery')) ? 'Service experiencing issues' : ''}
                </div>
                <ul class="issues-list">
                    ${criticalIssues.slice(0, 2).map(issue => `
                        <li><strong>${issue.title}</strong></li>
                    `).join('')}
                    ${advisoryIssues.slice(0, criticalIssues.length < 2 ? 2 - criticalIssues.length : 0).map(issue => `
                        <li>${issue.title}</li>
                    `).join('')}
                    ${(criticalIssues.length + advisoryIssues.length) > 2 ? `<li>... and ${(criticalIssues.length + advisoryIssues.length) - 2} more</li>` : ''}
                    ${(criticalIssues.length === 0 && advisoryIssues.length === 0 && (service.status === 'serviceDegradation' || service.status === 'extendedRecovery')) ? '<li>Check M365 Admin Center for details</li>' : ''}
                </ul>
            ` : ''}
            <div class="click-hint">Click to view details</div>
        `;

        // Add click event for modal
        const clickHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Card clicked for service:', service.service);
            
            try {
                this.showServiceModal(service, issues);
            } catch (error) {
                console.error('Error showing modal:', error);
            }
        };

        card.addEventListener('click', clickHandler);

        return card;
    }

    getStatusPriority(status, issues) {
        // Separate critical and advisory issues
        const criticalIssues = issues.filter(issue => {
            const hasIncidentStatus = issue.status === 'investigating' || 
                                    issue.status === 'serviceDegradation' ||
                                    issue.status === 'serviceInterruption';
            
            const isExplicitlyAdvisory = issue.classification?.toLowerCase() === 'advisory';
            
            return hasIncidentStatus && !isExplicitlyAdvisory;
        });

        const advisoryIssues = issues.filter(issue => {
            const isAdvisory = issue.classification?.toLowerCase() === 'advisory' || 
                              issue.title?.toLowerCase().includes('advisory') ||
                              issue.impactDescription?.toLowerCase().includes('advisory');
                               
            const isActive = !issue.isResolved && 
                           issue.status !== 'serviceRestored' && 
                           issue.status !== 'serviceOperational';
            
            return isAdvisory && isActive;
        });

        // Priority order (lower number = higher priority = shown first):
        // 1. Service Interruption (critical)
        // 2. Service Degradation 
        // 3. Extended Recovery
        // 4. Operational but with critical issues
        // 5. Advisory Issues only
        // 6. Operational with only advisory issues  
        // 7. Healthy/Operational (no issues)
        // 8. Unknown status

        switch (status?.toLowerCase()) {
            case 'serviceinterruption':
                return 1;
            case 'servicedegradation':
                return 2;
            case 'extendedrecovery':
                return 3;
            case 'serviceoperational':
                if (criticalIssues.length > 0) return 4;
                if (advisoryIssues.length > 0) return 6;
                return 7; // No issues
            case 'advisoryissue':
                return 5;
            default:
                return 8; // Unknown status last
        }
    }

    getStatusClass(status) {
        switch (status?.toLowerCase()) {
            case 'serviceoperational':
                return 'healthy';
            case 'servicedegradation':
                return 'degradation';
            case 'serviceinterruption':
                return 'issues';
            case 'advisoryissue':
                return 'advisory';
            case 'extendedrecovery':
                return 'advisory';
            default:
                return 'unknown';
        }
    }

    getStatusIcon(status) {
        switch (status?.toLowerCase()) {
            case 'serviceoperational':
                return '✓';
            case 'servicedegradation':
                return '⚠';
            case 'serviceinterruption':
                return '!';
            case 'advisoryissue':
                return '⚠';
            case 'extendedrecovery':
                return '⚠';
            default:
                return '?';
        }
    }

    getStatusText(status) {
        switch (status?.toLowerCase()) {
            case 'serviceoperational':
                return 'Service Operational';
            case 'servicedegradation':
                return 'Service Degradation';
            case 'serviceinterruption':
                return 'Service Interruption';
            case 'advisoryissue':
                return 'Service Advisory';
            case 'extendedrecovery':
                return 'Extended Recovery';
            default:
                return 'Status Unknown';
        }
    }

    showLoginRequired() {
        const servicesGrid = document.getElementById('servicesGrid');
        servicesGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; background: white; border-radius: 10px;">
                <h3>Authentication Required</h3>
                <p>Click the button below to sign in with your Microsoft 365 admin account.</p>
                <button onclick="window.dashboard.login()" style="background: #0078d4; color: white; border: none; padding: 15px 30px; border-radius: 5px; cursor: pointer; font-size: 1em; margin-top: 20px;">
                    Sign In to Microsoft 365
                </button>
                <p style="margin-top: 20px; font-size: 0.9em; color: #666;">
                    Make sure you've added http://localhost:8080 to your Azure AD App Registration redirect URIs.
                </p>
            </div>
        `;
    }

    showError(title, message) {
        const errorMessage = document.getElementById('errorMessage');
        const errorDetails = document.getElementById('errorDetails');
        
        errorDetails.textContent = message;
        errorMessage.style.display = 'block';

        // Also show in grid if no services loaded
        const servicesGrid = document.getElementById('servicesGrid');
        if (servicesGrid.children.length === 0) {
            servicesGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px; background: #fee; border: 1px solid #fcc; border-radius: 10px;">
                    <h3>${title}</h3>
                    <p>${message}</p>
                </div>
            `;
        }
    }

    updateLastUpdatedTime() {
        const lastUpdatedElement = document.getElementById('lastUpdated');
        lastUpdatedElement.textContent = new Date().toLocaleString();
    }

    startAutoRefresh() {
        this.stopAutoRefresh(); // Clear any existing interval
        this.refreshInterval = setInterval(() => {
            this.loadServiceHealth();
        }, 5 * 60 * 1000); // 5 minutes
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    showServiceModal(service, allIssues) {
        console.log('=== MODAL DEBUG ===');
        console.log('showServiceModal called with:', service, allIssues);
        
        // Create modal if it doesn't exist
        let modal = document.getElementById('serviceModal');
        console.log('Existing modal:', modal);
        
        if (!modal) {
            console.log('Creating new modal');
            modal = document.createElement('div');
            modal.id = 'serviceModal';
            modal.className = 'modal';
            document.body.appendChild(modal);
            console.log('Modal created and appended to body');
        }

        const statusClass = this.getStatusClass(service.status);
        
        // Separate issues into categories
        const criticalIssues = allIssues.filter(issue => {
            const hasIncidentStatus = issue.status === 'investigating' || 
                                    issue.status === 'serviceDegradation' ||
                                    issue.status === 'serviceInterruption';
            
            // Don't treat as critical if explicitly classified as advisory
            const isExplicitlyAdvisory = issue.classification?.toLowerCase() === 'advisory';
            
            return hasIncidentStatus && !isExplicitlyAdvisory;
        });

        const advisoryIssues = allIssues.filter(issue => {
            // Check if it's explicitly marked as advisory (case insensitive)
            const isAdvisory = issue.classification?.toLowerCase() === 'advisory' || 
                              issue.title?.toLowerCase().includes('advisory') ||
                              issue.impactDescription?.toLowerCase().includes('advisory');
            
            // Only include ACTIVE advisories - not resolved ones
            const isActive = !issue.isResolved && 
                           issue.status !== 'serviceRestored' && 
                           issue.status !== 'serviceOperational';
            
            return isAdvisory && isActive;
        });

        const recentIssues = allIssues.filter(issue => 
            issue.status === 'serviceRestored' || 
            issue.status === 'serviceOperational'
        ).slice(0, 10); // Limit recent issues
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${service.service}</h2>
                    <span class="close">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="service-status-large ${statusClass}">
                        <div class="status-indicator-large ${statusClass}">
                            ${this.getStatusIcon(service.status)}
                        </div>
                        <div class="status-text-large">
                            ${this.getStatusText(service.status)}
                        </div>
                    </div>
                    
                    ${criticalIssues.length > 0 ? `
                        <div class="issues-section">
                            <h3>🚨 Critical Issues (${criticalIssues.length})</h3>
                            ${criticalIssues.map(issue => `
                                <div class="issue-item active-issue">
                                    <div class="issue-header">
                                        <div class="issue-title">${issue.title}</div>
                                        <div class="issue-status ${this.getIssueStatusClass(issue.status)}">
                                            ${this.formatIssueStatus(issue.status)}
                                        </div>
                                    </div>
                                    ${issue.impactDescription ? `
                                        <div class="issue-description">
                                            <strong>Impact:</strong> ${issue.impactDescription}
                                        </div>
                                    ` : ''}
                                    ${issue.lastModifiedDateTime ? `
                                        <div class="issue-updated">
                                            Last updated: ${new Date(issue.lastModifiedDateTime).toLocaleString()}
                                        </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    ${advisoryIssues.length > 0 ? `
                        <div class="issues-section">
                            <h3>ℹ️ Advisory Items (${advisoryIssues.length})</h3>
                            <div class="advisory-issues-container">
                                ${advisoryIssues.map(issue => `
                                    <div class="issue-item advisory-issue">
                                        <div class="issue-header">
                                            <div class="issue-title">${issue.title}</div>
                                            <div class="issue-status advisory">
                                                Advisory
                                            </div>
                                        </div>
                                        ${issue.impactDescription ? `
                                            <div class="issue-description">
                                                <strong>Details:</strong> ${issue.impactDescription}
                                            </div>
                                        ` : ''}
                                        ${issue.lastModifiedDateTime ? `
                                            <div class="issue-updated">
                                                Last updated: ${new Date(issue.lastModifiedDateTime).toLocaleString()}
                                            </div>
                                        ` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${recentIssues.length > 0 ? `
                        <div class="issues-section">
                            <h3>✅ Recently Resolved (${recentIssues.length})</h3>
                            <div class="recent-issues-container">
                                ${recentIssues.map(issue => `
                                    <div class="issue-item recent-issue">
                                        <div class="issue-header">
                                            <div class="issue-title">${issue.title}</div>
                                            <div class="issue-status ${this.getIssueStatusClass(issue.status)}">
                                                ${this.formatIssueStatus(issue.status)}
                                            </div>
                                        </div>
                                        ${issue.lastModifiedDateTime ? `
                                            <div class="issue-updated">
                                                Resolved: ${new Date(issue.lastModifiedDateTime).toLocaleString()}
                                            </div>
                                        ` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${criticalIssues.length === 0 && advisoryIssues.length === 0 && recentIssues.length === 0 ? `
                        <div class="no-issues">
                            <p>No issues reported for this service.</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        console.log('Setting modal display to block');
        modal.style.display = 'block';
        console.log('Modal should now be visible');

        // Close modal functionality
        const closeBtn = modal.querySelector('.close');
        if (closeBtn) {
            closeBtn.onclick = () => {
                console.log('Close button clicked');
                modal.style.display = 'none';
            };
        } else {
            console.error('Close button not found in modal');
        }
        
        modal.onclick = (e) => {
            if (e.target === modal) {
                console.log('Modal background clicked, closing');
                modal.style.display = 'none';
            }
        };
        
        console.log('Modal setup complete');
    }

    getIssueStatusClass(status) {
        switch (status?.toLowerCase()) {
            case 'investigating':
                return 'investigating';
            case 'serviceoperational':
                return 'operational';
            case 'servicerestored':
                return 'restored';
            case 'servicedegradation':
                return 'degradation';
            default:
                return 'unknown';
        }
    }

    formatIssueStatus(status) {
        switch (status?.toLowerCase()) {
            case 'investigating':
                return 'Investigating';
            case 'serviceoperational':
                return 'Operational';
            case 'servicerestored':
                return 'Restored';
            case 'servicedegradation':
                return 'Degraded';
            default:
                return status || 'Unknown';
        }
    }

    toggleFullscreen() {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            document.documentElement.requestFullscreen();
        }
    }

    setDisplayMode(mode) {
        // Remove existing mode classes
        document.body.classList.remove('standard-mode', 'kiosk-mode', 'compact-mode');
        
        // Add new mode class
        document.body.classList.add(`${mode}-mode`);
        
        // Save preference
        localStorage.setItem('displayMode', mode);

        // Update dropdown if it exists
        const displayModeSelect = document.getElementById('displayMode');
        if (displayModeSelect) {
            displayModeSelect.value = mode;
        }

        // If switching to kiosk mode, also go fullscreen
        if (mode === 'kiosk' && !document.fullscreenElement) {
            setTimeout(() => {
                this.toggleFullscreen();
            }, 100);
        }
    }

    exitKioskMode() {
        console.log('Exiting kiosk mode...'); // Debug log
        
        // Exit fullscreen if active
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }
        
        // Nuclear approach: completely reset everything
        document.body.className = 'standard-mode';
        localStorage.setItem('displayMode', 'standard');
        
        // Force controls to be visible with multiple methods
        const controls = document.querySelector('.controls');
        if (controls) {
            controls.style.display = 'flex';
            controls.style.visibility = 'visible';
            controls.style.opacity = '1';
            controls.classList.remove('hidden');
        }
        
        // Update dropdown
        const displayModeSelect = document.getElementById('displayMode');
        if (displayModeSelect) {
            displayModeSelect.value = 'standard';
            displayModeSelect.style.display = 'block';
        }
        
        // Force a repaint
        document.body.offsetHeight;
        
        console.log('Kiosk mode exit complete');
        console.log('Body class:', document.body.className);
        console.log('Controls display:', getComputedStyle(controls).display);
    }
}

// Initialize the dashboard when the page loads
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.dashboard = new M365ServiceHealthDashboard();
    } catch (error) {
        console.error('Error initializing dashboard:', error);
    }
});

// Global debug function for testing modals
window.testModal = function() {
    console.log('testModal function called');
    if (window.dashboard && window.dashboard.showServiceModal) {
        window.dashboard.showServiceModal(
            {service: 'Test Service', status: 'advisoryissue'}, 
            [{title: 'Test Advisory Issue', status: 'investigating', classification: 'Advisory'}]
        );
    } else {
        console.error('Dashboard not initialized or showServiceModal not found');
    }
};