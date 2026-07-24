// background.js

// Function to attempt login by injecting token into localStorage
async function attemptLogin(token, tabId) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            world: "MAIN",
            func: (authToken) => {
                // This function runs in the context of the Discord page
                
                // Discord sometimes overrides the window.localStorage object for security.
                // This iframe trick ensures we get the real, un-overridden localStorage object
                // to set the token successfully.
                try {
                  let iframe = document.createElement('iframe');
                  document.body.appendChild(iframe);
                  iframe.contentWindow.localStorage.setItem('token', '"' + authToken + '"');
                  iframe.remove();
                } catch (e) {
                  // Fallback
                  window.localStorage.setItem("token", `"${authToken}"`);
                }
                // Navigate to the app to apply the token is removed from here
                // to prevent the execution context from being destroyed before
                // executeScript finishes, which caused the false error message.
            },
            args: [token]
        });
        console.log("Token injection script executed for tab:", tabId);
        return true;
    } catch (error) {
        console.error(`Failed to execute script on tab ${tabId}:`, error);
        // Common error: Cannot access contents of url "chrome://..." or other restricted pages.
        // Extension manifest must have host permissions for "https://discord.com/*"
        return false;
    }
}

// Listen for messages from the popup script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "loginWithToken") {
        const token = message.token;

        // 1. Validate the token by fetching user info from Discord API
        fetch("https://discord.com/api/v9/users/@me", {
            headers: {
                "Authorization": token,
                "Content-Type": "application/json"
            }
        })
        .then(response => {
            if (response.ok) {
                // Token is valid
                console.log("Token validation successful.");
                // 2. Find Discord tabs and attempt to inject the token
                // Search across all windows, not just the current one
                chrome.tabs.query({ url: "https://discord.com/*" }, (tabs) => {
                    if (tabs.length > 0) {
                        // Attempt login on the first found Discord tab
                        attemptLogin(token, tabs[0].id).then(success => {
                            if (success) {
                                // Navigate to the app or reload if already there
                                if (tabs[0].url && (tabs[0].url.includes("/channels") || tabs[0].url.includes("/app"))) {
                                    chrome.tabs.reload(tabs[0].id);
                                } else {
                                    chrome.tabs.update(tabs[0].id, { url: "https://discord.com/app" });
                                }
                                sendResponse({ success: true, message: "Logged in successfully! Navigating..." });
                            } else {
                                sendResponse({ success: false, message: "Failed to inject token. Is Discord open?" });
                            }
                        });
                    } else {
                        // No Discord tab found, open one and login
                        console.log("Token valid, opening new Discord tab to inject.");
                        chrome.tabs.create({ url: "https://discord.com/login" }, (newTab) => {
                            // Wait for the new tab to finish loading
                            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                                if (tabId === newTab.id && info.status === 'complete') {
                                    chrome.tabs.onUpdated.removeListener(listener);
                                    
                                    attemptLogin(token, newTab.id).then(success => {
                                        if (success) {
                                            // Make sure to navigate the new tab to the app!
                                            chrome.tabs.update(newTab.id, { url: "https://discord.com/app" });
                                            sendResponse({ success: true, message: "Opened Discord and logged in." });
                                        } else {
                                            sendResponse({ success: false, message: "Opened Discord but failed to inject." });
                                        }
                                    });
                                }
                            });
                        });
                    }
                });
            } else {
                // Token is invalid
                console.log("Token validation failed. Status:", response.status);
                sendResponse({ success: false, message: "Invalid token." });
            }
        })
        .catch(error => {
            console.error("Error during token validation fetch:", error);
            sendResponse({ success: false, message: "Network error during validation." });
        });

        // Return true to indicate you wish to send a response asynchronously
        return true; 
    }
});

console.log("Discord Token Login background script loaded.");

