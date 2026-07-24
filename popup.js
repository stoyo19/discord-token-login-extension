document.addEventListener('DOMContentLoaded', () => {
    const tokenInput = document.getElementById('tokenInput');
    const loginButton = document.getElementById('loginBtn');
    const errorMessageDiv = document.getElementById('errorMessage');

    // Clear error on input
    tokenInput.addEventListener('input', () => {
        errorMessageDiv.textContent = '';
        tokenInput.classList.remove('input-error');
    });

    // Login button click
    loginButton.addEventListener('click', async () => {
        const token = tokenInput.value.trim();

        // Clear previous errors
        errorMessageDiv.textContent = '';
        errorMessageDiv.style.color = '#ef4444'; // reset to default error color
        tokenInput.classList.remove('input-error');

        if (!token) {
            errorMessageDiv.textContent = 'Token cannot be empty.';
            tokenInput.classList.add('input-error');
            return;
        }

        // Disable button while processing
        loginButton.disabled = true;
        loginButton.textContent = 'Logging in...';

        try {
            // Send token to background script for validation and login
            const response = await chrome.runtime.sendMessage({ 
                action: 'loginWithToken', 
                token: token 
            });

            if (response.success) {
                errorMessageDiv.textContent = 'Login successful! Closing...';
                errorMessageDiv.style.color = '#43b581'; // Discord green for success
                // Close popup after a short delay
                setTimeout(() => {
                    window.close();
                }, 1500);
            } else {
                errorMessageDiv.textContent = response.message || 'Login failed. Invalid token?';
                tokenInput.classList.add('input-error');
                loginButton.disabled = false;
                loginButton.textContent = 'Login';
            }
        } catch (error) {
            console.error('Error communicating with background script:', error);
            errorMessageDiv.textContent = 'An error occurred. Check console.';
            tokenInput.classList.add('input-error');
            loginButton.disabled = false;
            loginButton.textContent = 'Login';
        }
    });

    // --- New: Get Token Logic ---
    const getTokenBtn = document.getElementById('getTokenBtn');
    const tokenResultContainer = document.getElementById('tokenResultContainer');
    const retrievedTokenInput = document.getElementById('retrievedToken');
    const copyTokenBtn = document.getElementById('copyTokenBtn');

    getTokenBtn.addEventListener('click', async () => {
        errorMessageDiv.textContent = '';
        errorMessageDiv.style.color = '#ef4444';
        tokenResultContainer.style.display = 'none';

        try {
            // Check active tab
            let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab || !tab.url || !tab.url.startsWith("https://discord.com")) {
                errorMessageDiv.textContent = 'Error: You are not on discord.com.';
                return;
            }

            getTokenBtn.textContent = 'Getting...';
            getTokenBtn.disabled = true;

            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                world: "MAIN",
                func: () => {
                    // Try to bypass Discord's localStorage override using iframe trick
                    try {
                        let iframe = document.createElement('iframe');
                        document.body.appendChild(iframe);
                        let t = iframe.contentWindow.localStorage.getItem('token');
                        iframe.remove();
                        return t;
                    } catch (e) {
                        return window.localStorage.getItem('token');
                    }
                }
            });

            getTokenBtn.textContent = 'Get Current Token';
            getTokenBtn.disabled = false;

            let extractedToken = results[0].result;
            if (extractedToken) {
                // Token comes with quotes from Discord's localStorage
                extractedToken = extractedToken.replace(/^"|"$/g, '');
                retrievedTokenInput.value = extractedToken;
                tokenResultContainer.style.display = 'block';
                errorMessageDiv.textContent = 'Token retrieved successfully!';
                errorMessageDiv.style.color = '#43b581';
            } else {
                errorMessageDiv.textContent = 'Error: No token found. Are you logged in?';
            }

        } catch (error) {
            console.error(error);
            getTokenBtn.textContent = 'Get Current Token';
            getTokenBtn.disabled = false;
            errorMessageDiv.textContent = 'Failed to read token. Refresh Discord and try again.';
        }
    });

    copyTokenBtn.addEventListener('click', () => {
        retrievedTokenInput.select();
        document.execCommand('copy');
        copyTokenBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyTokenBtn.textContent = 'Copy';
        }, 1500);
    });
});
