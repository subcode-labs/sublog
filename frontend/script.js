document.addEventListener('DOMContentLoaded', () => {
    const logContainer = document.getElementById('log-container');
    const emptyState = document.getElementById('empty-state');
    const filterTextInput = document.getElementById('filter-text');
    const filterLevelSelect = document.getElementById('filter-level');
    const clearButton = document.getElementById('clear-logs');
    const statusDisplay = document.getElementById('status');
    const themeToggleButton = document.getElementById('toggle-theme');
    const copyButton = document.getElementById('copy-curl');
    const toggleMetadataButton = document.getElementById('toggle-metadata');
    const pauseButton = document.getElementById('pause-logs');
    // Footer elements
    const totalLogsElement = document.getElementById('total-logs');
    const displayedLogsElement = document.getElementById('displayed-logs');
    const resetDbButton = document.getElementById('reset-db');

    const MAX_LOGS = 500; // Limit number of logs displayed in DOM
    let allLogs = []; // Store all logs for filtering and rendering
    let visibleLogs = []; // Store filtered logs for rendering
    let webSocket;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 10;
    const RECONNECT_DELAY = 5000; // ms
    let hasLogs = false; // Track if we have any logs
    let showMetadata = localStorage.getItem('showMetadata') === 'true' || false;
    let isPaused = false; // Track if log updates are paused
    let pendingLogs = []; // Store logs received while paused
    
    // Initialize the app
    function initApp() {
        // Create container for logs
        logContainer.innerHTML = '';
        
        // Add empty state as needed
        if (!hasLogs) {
            logContainer.appendChild(emptyState);
        }
        
        // Initialize metadata toggle icons
        initMetadataIcons();
    }
    
    // Load existing logs when the page loads
    function loadExistingLogs() {
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'loading-indicator';
        loadingIndicator.textContent = 'Loading logs';
        logContainer.appendChild(loadingIndicator);
        
        const limit = MAX_LOGS;
        fetch(`/logs/recent?limit=${limit}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status}`);
                }
                return response.json();
            })
            .then(logs => {
                logContainer.removeChild(loadingIndicator);
                
                if (logs && logs.length > 0) {
                    // Store logs and render them
                    allLogs = logs.reverse(); // Reverse to show newest first
                    visibleLogs = [...allLogs];
                    hasLogs = true;
                    
                    // Render logs
                    renderLogs();
                    console.log(`Loaded ${logs.length} existing logs`);
                }
                
                // Update displayed logs count after loading
                updateDisplayedLogsCount();
            })
            .catch(error => {
                logContainer.removeChild(loadingIndicator);
                console.error('Failed to load existing logs:', error);
            });
    }

    // Render logs to the DOM
    function renderLogs() {
        // Clear the container
        logContainer.innerHTML = '';
        
        if (visibleLogs.length === 0) {
            logContainer.appendChild(emptyState);
            return;
        }
        
        // Create a fragment to improve performance
        const fragment = document.createDocumentFragment();
        
        // Render each log
        visibleLogs.forEach(log => {
            const logElement = createLogElement(log);
            fragment.appendChild(logElement);
        });
        
        // Add logs to the container
        logContainer.appendChild(fragment);
        
        // Update displayed logs count
        updateDisplayedLogsCount();
    }

    // Get total log count from database
    function fetchTotalLogCount() {
        fetch('/logs/count')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                totalLogsElement.textContent = data.count;
            })
            .catch(error => {
                console.error('Failed to fetch total log count:', error);
            });
    }

    // Reset the database after user confirmation
    resetDbButton.addEventListener('click', () => {
        if (confirm('Are you sure you want to delete all logs from the database? This action cannot be undone.')) {
            fetch('/logs/all', {
                method: 'DELETE',
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('Database reset successful:', data);
                    // Clear logs arrays
                    allLogs = [];
                    visibleLogs = [];
                    hasLogs = false;
                    
                    // Reinitialize app
                    initApp();
                    
                    // Update counts
                    fetchTotalLogCount();
                    updateDisplayedLogsCount();
                })
                .catch(error => {
                    console.error('Failed to reset database:', error);
                    alert('Failed to reset database: ' + error.message);
                });
        }
    });

    // Update the displayed logs count
    function updateDisplayedLogsCount() {
        displayedLogsElement.textContent = visibleLogs.length;
    }

    // Copy to clipboard functionality
    copyButton.addEventListener('click', () => {
        const curlCommand = document.querySelector('.code-example code').textContent;
        
        // Create a temporary textarea element to copy from
        const textarea = document.createElement('textarea');
        // Preserve backslashes but replace double backslashes with newlines
        textarea.value = curlCommand
            .replace('{window.location.host}', window.location.host)
            .replace(/\\\s*\n\s*/g, '\\\n');
        
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            document.execCommand('copy');
            // Show success feedback
            const copyIcon = copyButton.querySelector('svg');
            
            // Create a success icon
            const successIcon = document.createElement('div');
            successIcon.textContent = '✓';
            successIcon.style.color = 'var(--text-primary)';
            successIcon.style.fontSize = '16px';
            
            // Replace icon with checkmark temporarily
            copyIcon.style.display = 'none';
            copyButton.appendChild(successIcon);
            
            setTimeout(() => {
                // Remove success icon and restore original
                copyButton.removeChild(successIcon);
                copyIcon.style.display = '';
            }, 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        } finally {
            document.body.removeChild(textarea);
        }
    });

    // Theme management
    function initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeIcon(savedTheme);
    }

    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    }

    function updateThemeIcon(theme) {
        const moonIcon = themeToggleButton.querySelector('.moon-icon');
        const sunIcon = themeToggleButton.querySelector('.sun-icon');
        
        if (theme === 'dark') {
            moonIcon.classList.add('hidden');
            sunIcon.classList.remove('hidden');
        } else {
            moonIcon.classList.remove('hidden');
            sunIcon.classList.add('hidden');
        }
    }

    // Initialize theme
    initTheme();

    // Add theme toggle event listener
    themeToggleButton.addEventListener('click', toggleTheme);

    function updateEmptyState() {
        if (visibleLogs.length === 0) {
            if (!logContainer.contains(emptyState)) {
                logContainer.appendChild(emptyState);
            }
            emptyState.classList.remove('hidden');
            hasLogs = false;
        } else {
            if (logContainer.contains(emptyState)) {
                logContainer.removeChild(emptyState);
            }
            emptyState.classList.add('hidden');
            hasLogs = true;
        }
    }

    function updateStatus(message, isConnected) {
        statusDisplay.textContent = message;
        statusDisplay.className = isConnected ? 'connected' : 'disconnected';
    }

    // Create the export button
    function createExportButton() {
        const exportButton = document.createElement('button');
        exportButton.id = 'export-logs';
        exportButton.className = 'export-button';
        exportButton.title = 'Export logs as JSON or CSV';
        exportButton.setAttribute('aria-label', 'Export logs');
        
        // Add the export icon
        const exportIcon = document.createElement('img');
        exportIcon.src = 'images/icons/MdiDatabaseExport.svg';
        exportIcon.alt = '';
        exportIcon.className = 'icon export-icon';
        
        const buttonText = document.createElement('span');
        buttonText.textContent = 'Export';
        
        exportButton.appendChild(exportIcon);
        exportButton.appendChild(buttonText);
        
        exportButton.addEventListener('click', () => {
            showExportOptions();
        });
        
        // Add the export button to the footer actions
        document.querySelector('.footer-actions').prepend(exportButton);
    }
    
    // Show export options dialog
    function showExportOptions() {
        // Check if logs are available
        if (allLogs.length === 0) {
            alert('No logs available to export');
            return;
        }
        
        // Ask for export format
        const format = window.prompt('Export format (json or csv):', 'json');
        
        if (!format) return; // User cancelled
        
        const lowerFormat = format.toLowerCase();
        if (lowerFormat === 'json') {
            exportLogsAsJson();
        } else if (lowerFormat === 'csv') {
            exportLogsAsCsv();
        } else {
            alert('Unsupported format. Please choose json or csv.');
        }
    }
    
    // Export logs as JSON
    function exportLogsAsJson() {
        const jsonString = JSON.stringify(allLogs, null, 2);
        downloadFile(jsonString, 'sublog-export.json', 'application/json');
    }
    
    // Export logs as CSV
    function exportLogsAsCsv() {
        // CSV header
        let csv = 'timestamp,level,message,metadata\n';
        
        // Add each log entry
        allLogs.forEach(log => {
            const timestamp = log.timestamp;
            const level = log.level;
            // Escape quotes in message
            const message = `"${(log.message || '').replace(/"/g, '""')}"`;
            // Convert metadata to string and escape quotes
            const metadata = `"${JSON.stringify(log.metadata || {}).replace(/"/g, '""')}"`;
            
            csv += `${timestamp},${level},${message},${metadata}\n`;
        });
        
        downloadFile(csv, 'sublog-export.csv', 'text/csv');
    }
    
    // Helper to trigger file download
    function downloadFile(content, filename, type) {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    // Add Export Button to UI
    createExportButton();

    function connectWebSocket() {
        // Determine WebSocket protocol (ws or wss)
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/ws`;

        updateStatus('Connecting...', false);
        webSocket = new WebSocket(wsUrl);

        webSocket.onopen = () => {
            console.log('WebSocket connection established');
            updateStatus('Connected', true);
            reconnectAttempts = 0; // Reset attempts on successful connection
        };

        webSocket.onmessage = (event) => {
            try {
                const logEntry = JSON.parse(event.data);
                addLogEntryToDOM(logEntry);
            } catch (error) {
                console.error('Failed to parse incoming log:', error, event.data);
            }
        };

        webSocket.onerror = (error) => {
            console.error('WebSocket error:', error);
            updateStatus('Error', false);
            // Don't attempt reconnect here, rely on onclose
        };

        webSocket.onclose = (event) => {
            console.log('WebSocket connection closed:', event.reason, `(Code: ${event.code})`);
            updateStatus('Disconnected', false);

            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                console.log(`Attempting to reconnect in ${RECONNECT_DELAY / 1000}s... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
                updateStatus(`Disconnected. Reconnecting (${reconnectAttempts})...`, false);
                setTimeout(connectWebSocket, RECONNECT_DELAY);
            } else {
                console.error('Max reconnection attempts reached. Please refresh the page.');
                updateStatus('Disconnected. Max reconnect attempts reached.', false);
            }
        };
    }

    function formatTimestamp(isoString) {
        if (!isoString) return '';
        try {
            const date = new Date(isoString);
            // Format as YYYY-MM-DD HH:MM:SS.ms
            return date.toISOString().replace('T', ' ').replace('Z', '');
        } catch(e) {
            return isoString; // Return original if parsing fails
        }
    }

    function formatMetadata(metadataString) {
        if (!metadataString || metadataString === '{}') return '';
        try {
            const metaObj = JSON.parse(metadataString);
            // Simple pretty print JSON
            return JSON.stringify(metaObj, null, 2);
        } catch (e) {
            return metadataString; // Return raw string if it's not valid JSON
        }
    }

    // Function to handle metadata copy
    function copyMetadataToClipboard(metadataText) {
        const textarea = document.createElement('textarea');
        textarea.value = metadataText;
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            document.execCommand('copy');
            // Visual feedback handled by the calling button
        } catch (err) {
            console.error('Failed to copy metadata: ', err);
        } finally {
            document.body.removeChild(textarea);
        }
    }

    function addLogEntryToDOM(log) {
        // If paused, store log for later and update count
        if (isPaused) {
            pendingLogs.push(log);
            updatePendingCount();
            return;
        }
        
        // Add to all logs array
        allLogs.unshift(log); // Add to beginning (newest first)
        
        // Apply current filters
        applyFilters();
        
        // Update empty state
        updateEmptyState();
        
        // Update total logs count
        fetchTotalLogCount();
    }

    function applyFilters() {
        const filterText = filterTextInput.value.toLowerCase();
        const filterLevel = filterLevelSelect.value;
        
        visibleLogs = allLogs.filter(log => {
            // Apply level filter
            if (filterLevel && log.level !== filterLevel) {
                return false;
            }
            
            // Apply text filter
            if (filterText) {
                const message = (log.message || '').toLowerCase();
                const metadata = JSON.stringify(log.metadata || {}).toLowerCase();
                return message.includes(filterText) || metadata.includes(filterText);
            }
            
            return true;
        });
        
        // Render updated logs
        renderLogs();
        updateEmptyState();
    }

    // Create log entry DOM element with simple side-by-side layout
    function createLogElement(log) {
        const logEl = document.createElement('div');
        logEl.className = `log-entry level-${log.level || 'info'}`;
        
        // 1. Left column: timestamp and level
        const metaContainer = document.createElement('div');
        metaContainer.className = 'log-meta-container';
        
        // Timestamp
        const timestampEl = document.createElement('span');
        timestampEl.className = 'log-timestamp';
        
        // Format timestamp
        const date = new Date(log.timestamp);
        const formattedDate = date.toLocaleTimeString([], { 
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false 
        });
        
        timestampEl.textContent = formattedDate;
        metaContainer.appendChild(timestampEl);
        
        // Log level
        const levelEl = document.createElement('span');
        levelEl.className = `log-level log-level-${log.level || 'info'}`;
        levelEl.textContent = log.level || 'info';
        metaContainer.appendChild(levelEl);
        
        // 2. Middle column: message
        const messageContainer = document.createElement('div');
        messageContainer.className = 'log-message-container';
        
        const messageEl = document.createElement('span');
        messageEl.className = 'log-message';
        messageEl.textContent = log.message || '';
        messageContainer.appendChild(messageEl);
        
        // 3. Right column: metadata (if it exists)
        
        // Add all columns to the log entry row
        const logRow = document.createElement('div');
        logRow.className = 'log-row';
        logRow.appendChild(metaContainer);
        logRow.appendChild(messageContainer);
        
        logEl.appendChild(logRow);
        
        // Only show if metadata exists and showMetadata is true
        if (log.metadata && Object.keys(log.metadata).length > 0) {
            // Format metadata
            let formattedJson = '';
            try {
                if (typeof log.metadata === 'object') {
                    formattedJson = JSON.stringify(log.metadata, null, 2);
                } else if (typeof log.metadata === 'string') {
                    try {
                        const parsedJson = JSON.parse(log.metadata);
                        formattedJson = JSON.stringify(parsedJson, null, 2);
                    } catch (e) {
                        formattedJson = log.metadata;
                    }
                } else {
                    formattedJson = String(log.metadata);
                }
            } catch (e) {
                formattedJson = 'Error formatting metadata';
            }
            
            // Create metadata row
            const metadataRow = document.createElement('div');
            metadataRow.className = 'metadata-row';
            if (!showMetadata) {
                metadataRow.style.display = 'none';
            }
            
            // Create metadata content
            const metadataContent = document.createElement('pre');
            metadataContent.className = 'metadata-content';
            metadataContent.textContent = formattedJson;
            
            // Copy button
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn';
            copyBtn.title = 'Copy metadata';
            copyBtn.setAttribute('aria-label', 'Copy metadata to clipboard');
            
            // Add SVG icon
            copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><!-- Icon from Material Symbols by Google - https://github.com/google/material-design-icons/blob/master/LICENSE --><path fill="currentColor" d="M9 18q-.825 0-1.412-.587T7 16V4q0-.825.588-1.412T9 2h9q.825 0 1.413.588T20 4v12q0 .825-.587 1.413T18 18zm0-2h9V4H9zm-4 6q-.825 0-1.412-.587T3 20V6h2v14h11v2zm4-6V4z"/></svg>`;
            
            metadataContent.appendChild(copyBtn);
            metadataRow.appendChild(metadataContent);
            logEl.appendChild(metadataRow);
            
            // Copy button click handler
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Try clipboard API first
                try {
                    navigator.clipboard.writeText(formattedJson).then(() => {
                        // Show success feedback
                        const svgIcon = copyBtn.querySelector('svg');
                        svgIcon.style.display = 'none';
                        const checkmark = document.createElement('span');
                        checkmark.textContent = '✓';
                        checkmark.style.color = 'var(--text-primary)';
                        checkmark.style.fontWeight = 'bold';
                        
                        copyBtn.appendChild(checkmark);
                        
                        setTimeout(() => {
                            copyBtn.removeChild(checkmark);
                            svgIcon.style.display = '';
                        }, 1500);
                    }).catch(() => {
                        // Fallback method
                        fallbackCopy(formattedJson, copyBtn, copyBtn.querySelector('svg'));
                    });
                } catch (e) {
                    // Fallback for older browsers
                    fallbackCopy(formattedJson, copyBtn, copyBtn.querySelector('svg'));
                }
            });
        }
        
        return logEl;
    }

    // Toggle all metadata sections visibility
    function toggleAllMetadata(visible) {
        document.querySelectorAll('.metadata-row').forEach(row => {
            row.style.display = visible ? '' : 'none';
        });
        
        // Save preference
        showMetadata = visible;
        localStorage.setItem('showMetadata', visible);
        
        // Update toggle button icons
        const expandIcon = toggleMetadataButton.querySelector('.expand-icon');
        const contractIcon = toggleMetadataButton.querySelector('.contract-icon');
        
        if (visible) {
            expandIcon.classList.add('hidden');
            contractIcon.classList.remove('hidden');
        } else {
            expandIcon.classList.remove('hidden');
            contractIcon.classList.add('hidden');
        }
    }

    // Set up toggle metadata button
    toggleMetadataButton.addEventListener('click', () => {
        toggleAllMetadata(!showMetadata);
    });

    // Initialize metadata icons based on stored preference
    function initMetadataIcons() {
        const expandIcon = toggleMetadataButton.querySelector('.expand-icon');
        const contractIcon = toggleMetadataButton.querySelector('.contract-icon');
        
        if (showMetadata) {
            expandIcon.classList.add('hidden');
            contractIcon.classList.remove('hidden');
        } else {
            expandIcon.classList.remove('hidden');
            contractIcon.classList.add('hidden');
        }
        
        // Make sure initial state is reflected correctly
        toggleAllMetadata(showMetadata);
    }

    // Set up filters
    filterTextInput.addEventListener('input', applyFilters);
    filterLevelSelect.addEventListener('change', applyFilters);
    
    // Initialize the application
    initApp();
    loadExistingLogs();
    fetchTotalLogCount();
    connectWebSocket();

    // Update curl example with the current host
    const codeExample = document.querySelector('.code-example code');
    if (codeExample) {
        const curlCommand = codeExample.innerHTML;
        codeExample.innerHTML = curlCommand.replace('{window.location.host}', window.location.host);
    }

    // Clear logs button functionality
    clearButton.addEventListener('click', () => {
        // Only clear UI logs, not the database
        allLogs = [];
        visibleLogs = [];
        hasLogs = false;
        
        // Reinitialize app
        initApp();
        
        // Update displayed count
        updateDisplayedLogsCount();
    });
    // Fallback copy for browsers without clipboard API
    function fallbackCopy(text, button, icon) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        
        try {
            const success = document.execCommand('copy');
            if (success) {
                // Show success feedback
                icon.style.display = 'none';
                const checkmark = document.createElement('span');
                checkmark.textContent = '✓';
                checkmark.style.color = 'var(--text-primary)';
                checkmark.style.fontWeight = 'bold';
                
                button.appendChild(checkmark);
                
                setTimeout(() => {
                    button.removeChild(checkmark);
                    icon.style.display = '';
                }, 1500);
            }
        } catch (e) {
            console.error('Copy failed:', e);
        }
        
        document.body.removeChild(textarea);
    }

    // Update the UI to show pending logs count when paused
    function updatePendingCount() {
        if (isPaused && pendingLogs.length > 0) {
            statusDisplay.textContent = `Paused (${pendingLogs.length} pending)`;
            statusDisplay.className = 'paused';
        }
    }

    // Set up pause button functionality
    pauseButton.addEventListener('click', () => {
        togglePause();
    });

    // Toggle pause state
    function togglePause() {
        isPaused = !isPaused;
        
        const pauseIcon = pauseButton.querySelector('.pause-icon');
        const playIcon = pauseButton.querySelector('.play-icon');
        
        if (isPaused) {
            pauseIcon.classList.add('hidden');
            playIcon.classList.remove('hidden');
            pauseButton.title = 'Resume log updates';
            statusDisplay.textContent = 'Paused (0 pending)';
            statusDisplay.className = 'paused';
        } else {
            pauseIcon.classList.remove('hidden');
            playIcon.classList.add('hidden');
            pauseButton.title = 'Pause log updates';
            
            // Process any pending logs
            processPendingLogs();
            
            // Update status back to connected
            updateStatus('Connected', true);
        }
    }

    // Process logs that came in while paused
    function processPendingLogs() {
        if (pendingLogs.length === 0) return;
        
        console.log(`Processing ${pendingLogs.length} pending logs`);
        
        // Add all pending logs to the main log array
        pendingLogs.forEach(log => {
            allLogs.unshift(log);
        });
        
        // Clear pending logs
        pendingLogs = [];
        
        // Apply filters and update the UI
        applyFilters();
        updateEmptyState();
        fetchTotalLogCount();
    }
});