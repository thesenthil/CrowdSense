/**
 * Dashboard JavaScript for Real-time Updates
 * Handles SocketIO, Chart.js, Ad Popups, and Analytics
 */

let genderChart, trendChart, adChart;
let crowdLimit = Infinity;
let isAlerting = false;
let alertIntervalId = null;
let currentAlertAudio = null; // Track current playing audio
let startTime = Date.now();
let adDisplayTimeout = null;
let currentAdPopup = null;

// Initialize dashboard
function initializeDashboard(socket) {
    setupSocketIO(socket);
    setupCharts();
    setupEventListeners();
    setupSidebarToggle();
    setupAlertSound();
    startUptimeCounter();
    
    // Initial data fetch
    fetchCounts();
    fetchAnalytics();
    fetchCurrentAd();
}


// SocketIO Setup
function setupSocketIO(socket) {
    socket.on('connect', () => {
        console.log('Connected to server');
        socket.emit('request_counts');
        socket.emit('request_analytics');
    });
    
    socket.on('count_update', (data) => {
        // Ensure data is valid
        const counts = {
            total: parseInt(data.total || 0) || 0,
            male: parseInt(data.male || 0) || 0,
            female: parseInt(data.female || 0) || 0,
        };
        
        console.log('[COUNTS] ========== RECEIVED UPDATE ==========');
        console.log('[COUNTS] Total:', counts.total);
        console.log('[COUNTS] Male:', counts.male);
        console.log('[COUNTS] Female:', counts.female);
        console.log('[COUNTS] Full data:', data);
        
        updateCounts(counts);
        updateGenderChart(counts);
        checkCrowdStatus(counts.total);
    });
    
    socket.on('show_ad', (ad) => {
        console.log('[AD] ========== RECEIVED AD EVENT ==========');
        console.log('[AD] Full ad object:', JSON.stringify(ad, null, 2));
        console.log('[AD] Ad path:', ad?.path);
        console.log('[AD] Ad type:', ad?.type);
        console.log('[AD] Ad name:', ad?.name);
        
        // Close any existing ad first
        Swal.close();
        
        if (ad && ad.path) {
            console.log('[AD] Calling showAdPopup...');
            // Small delay to ensure previous ad closes
            setTimeout(() => {
                showAdPopup(ad);
            }, 300);
        } else {
            console.error('[AD] ERROR: Invalid ad data - missing path');
            console.error('[AD] Received:', ad);
            Swal.fire({
                icon: 'warning',
                title: 'Ad Error',
                text: 'Advertisement data is invalid',
                timer: 3000
            });
        }
    });
    
    socket.on('analytics_update', (data) => {
        console.log('[ANALYTICS_UPDATE] Received:', JSON.stringify(data, null, 2));
        
        // Ensure data is properly structured
        if (data && data.current_counts !== undefined) {
            console.log('[ANALYTICS_UPDATE] Current counts in data:', data.current_counts);
        } else {
            console.warn('[ANALYTICS_UPDATE] Missing current_counts in data!');
        }
        
        updateAnalytics(data);
        
        // Update analytics modal if it's open
        const modal = document.getElementById('analyticsModal');
        if (modal && modal.classList.contains('show')) {
            console.log('[ANALYTICS_UPDATE] Modal is open, updating modal content...');
            updateAnalyticsModal(data);
            
            // Update ad chart immediately with new stats
            if (data.ad_stats && adChart) {
                console.log('[ANALYTICS_UPDATE] Updating ad chart with new stats:', data.ad_stats);
                adChart.data.datasets[0].data = [
                    data.ad_stats.male_ads_shown || 0,
                    data.ad_stats.female_ads_shown || 0
                ];
                adChart.update();
            }
        }
    });
}

// Chart Setup
function setupCharts() {
    // Gender Distribution Pie Chart
    const genderCtx = document.getElementById('genderChart');
    if (genderCtx) {
        genderChart = new Chart(genderCtx, {
            type: 'doughnut',
            data: {
                labels: ['Male', 'Female'],
                datasets: [{
                    data: [0, 0],
                    backgroundColor: ['#3498db', '#e74c3c'],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
    
    // Trend Chart (for analytics modal)
    const trendCtx = document.getElementById('trendChart');
    if (trendCtx) {
        trendChart = new Chart(trendCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Total Count',
                    data: [],
                    borderColor: '#3498db',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Crowd Size Trend Over Time',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            title: function(context) {
                                return 'Time Point: ' + context[0].label;
                            },
                            label: function(context) {
                                let description = '';
                                if (context.dataset.label === 'Total Count') {
                                    description = ' - Total people detected (all genders combined)';
                                } else if (context.dataset.label === 'Male') {
                                    description = ' - Adult males detected';
                                } else if (context.dataset.label === 'Female') {
                                    description = ' - Adult females detected';
                                }
                                return context.dataset.label + ': ' + context.parsed.y + ' people' + description;
                            }
                        }
                    },
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            generateLabels: function(chart) {
                                const original = Chart.defaults.plugins.legend.labels.generateLabels;
                                const labels = original(chart);
                                labels.forEach(label => {
                                    if (label.text === 'Total Count') {
                                        label.text = 'Total Count (All People)';
                                    } else if (label.text === 'Male') {
                                        label.text = 'Male (Adult Males)';
                                    } else if (label.text === 'Female') {
                                        label.text = 'Female (Adult Females)';
                                    }
                                });
                                return labels;
                            },
                            padding: 15,
                            usePointStyle: true,
                            font: {
                                size: 12
                            }
                        },
                        onClick: function(e, legendItem) {
                            // Allow clicking to show/hide data series
                            const index = legendItem.datasetIndex;
                            const chart = this.chart;
                            const meta = chart.getDatasetMeta(index);
                            meta.hidden = meta.hidden === null ? !chart.data.datasets[index].hidden : null;
                            chart.update();
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Recent Snapshots (Each number = one detection moment, 1 = oldest, 20 = newest)',
                            font: {
                                size: 11,
                                weight: 'bold'
                            }
                        },
                        ticks: {
                            maxRotation: 0,
                            minRotation: 0,
                            font: {
                                size: 10
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of People',
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        },
                        ticks: {
                            stepSize: 1,
                            callback: function(value) {
                                return value + ' people';
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }
    
    // Ad Chart (for analytics modal)
    const adCtx = document.getElementById('adChart');
    if (adCtx) {
        adChart = new Chart(adCtx, {
            type: 'bar',
            data: {
                labels: ['Male Ads', 'Female Ads'],
                datasets: [{
                    label: 'Ads Shown',
                    data: [0, 0],
                    backgroundColor: ['#3498db', '#e74c3c']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Advertisement Display Count',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + context.parsed.y + ' ads';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Ad Category',
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Ads Shown',
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        },
                        ticks: {
                            stepSize: 1,
                            callback: function(value) {
                                return value + ' ads';
                            }
                        }
                    }
                }
            }
        });
    }
}

// Event Listeners
function setupEventListeners() {
    // Set limit button
    const setLimitBtn = document.getElementById('set-limit-btn');
    const limitInput = document.getElementById('limit-input');
    
    if (setLimitBtn) {
        setLimitBtn.addEventListener('click', () => {
            const inputValue = limitInput.value.trim();
            
            // Check if input is empty or null
            if (inputValue === '' || inputValue === null || inputValue === undefined) {
                // Clear limit - stop all alerts immediately
                crowdLimit = Infinity;
                isAlerting = false;
                if (alertIntervalId) {
                    clearInterval(alertIntervalId);
                    alertIntervalId = null;
                }
                // Stop any currently playing audio
                stopAlertSound();
                const totalCount = parseInt(document.getElementById('total-count').textContent || '0', 10);
                checkCrowdStatus(totalCount);
                Swal.fire({
                    icon: 'info',
                    title: 'Limit Cleared',
                    text: 'Crowd limit has been removed. Alerts disabled.',
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                const newLimit = parseInt(inputValue, 10);
            if (!isNaN(newLimit) && newLimit >= 0) {
                crowdLimit = newLimit;
                const totalCount = parseInt(document.getElementById('total-count').textContent || '0', 10);
                checkCrowdStatus(totalCount);
                Swal.fire({
                    icon: 'success',
                    title: 'Limit Set',
                    text: `Crowd limit set to ${newLimit}`,
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                    // Invalid input - clear limit
                crowdLimit = Infinity;
                    isAlerting = false;
                    if (alertIntervalId) {
                        clearInterval(alertIntervalId);
                        alertIntervalId = null;
                    }
                    stopAlertSound();
                    const totalCount = parseInt(document.getElementById('total-count').textContent || '0', 10);
                    checkCrowdStatus(totalCount);
                    Swal.fire({
                        icon: 'error',
                        title: 'Invalid Input',
                        text: 'Please enter a valid number (0 or greater)',
                        timer: 2000,
                        showConfirmButton: false
                    });
                }
            }
            limitInput.value = '';
        });
        
        limitInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                setLimitBtn.click();
            }
        });
    }
}

// ===== SIDEBAR TOGGLE SETUP =====
function setupSidebarToggle() {
    console.log('[TOGGLE] ===== INITIALIZING TOGGLE SWITCH =====');
    
    // Function to find and setup toggle - with multiple retry attempts
    function findAndSetupToggle(attempt = 0) {
        const maxAttempts = 10;
        let toggleSwitch = document.getElementById('sidebarToggleNav');
        let leftSidebar = document.getElementById('leftSidebar');
        
        console.log(`[TOGGLE] Attempt ${attempt + 1}/${maxAttempts}`);
        console.log('[TOGGLE] Toggle switch found:', !!toggleSwitch);
        console.log('[TOGGLE] Sidebar found:', !!leftSidebar);
        
        if (!toggleSwitch || !leftSidebar) {
            if (attempt < maxAttempts) {
                console.warn('[TOGGLE] Elements not found, retrying in 200ms...');
                setTimeout(() => {
                    findAndSetupToggle(attempt + 1);
                }, 200);
                return;
            } else {
                console.error('[TOGGLE] ❌ FAILED: Elements not found after', maxAttempts, 'attempts');
                console.error('[TOGGLE] Toggle switch element:', toggleSwitch);
                console.error('[TOGGLE] Sidebar element:', leftSidebar);
                return;
            }
        }
        
        console.log('[TOGGLE] ✅ Both elements found!');
        console.log('[TOGGLE] Toggle switch:', toggleSwitch);
        console.log('[TOGGLE] Toggle switch classes:', toggleSwitch.className);
        console.log('[TOGGLE] Toggle switch style:', toggleSwitch.style.cssText);
        
        // Function to update toggle switch appearance with inline styles as backup
        const updateToggleAppearance = (isActive) => {
            console.log('[TOGGLE] updateToggleAppearance called with isActive:', isActive);
            
            // Get slider element
            const slider = toggleSwitch.querySelector('.toggle-slider');
            if (!slider) {
                console.error('[TOGGLE] ❌ CRITICAL: Slider element not found!');
                return;
            }
            
            if (isActive) {
                // Add active class FIRST
                toggleSwitch.classList.add('active');
                
                // REMOVE any existing inline styles that might conflict
                toggleSwitch.style.removeProperty('background');
                toggleSwitch.style.removeProperty('background-color');
                toggleSwitch.style.removeProperty('box-shadow');
                
                // Force inline styles - Beautiful Purple/Pink Gradient
                // IMPORTANT: Only set background (gradient), NOT background-color (they conflict!)
                const activeGradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)';
                
                // Remove background-color to avoid conflict with gradient
                toggleSwitch.style.removeProperty('background-color');
                
                // Set ONLY the gradient as background
                toggleSwitch.style.background = activeGradient;
                toggleSwitch.style.boxShadow = '0 0 20px rgba(102, 126, 234, 0.4), inset 0 2px 4px rgba(0, 0, 0, 0.1)';
                
                // Use cssText to completely override - ONLY gradient, no background-color
                toggleSwitch.style.cssText = 'background: ' + activeGradient + '; box-shadow: 0 0 20px rgba(102, 126, 234, 0.4), inset 0 2px 4px rgba(0, 0, 0, 0.1);';
                
                // Move slider to right
                slider.style.transform = 'translateX(32px)';
                slider.style.left = '32px';
                slider.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.5)';
                slider.style.cssText += '; transform: translateX(32px); left: 32px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.5);';
                
                console.log('[TOGGLE] ✅ Set to ACTIVE - Beautiful Purple/Pink Gradient');
                console.log('[TOGGLE] Background:', toggleSwitch.style.background);
                console.log('[TOGGLE] Computed background:', window.getComputedStyle(toggleSwitch).background);
            } else {
                // Remove active class FIRST
                toggleSwitch.classList.remove('active');
                
                // REMOVE any existing inline styles
                toggleSwitch.style.removeProperty('background');
                toggleSwitch.style.removeProperty('background-color');
                toggleSwitch.style.removeProperty('box-shadow');
                
                // Force inline styles - Gray inactive state
                // Remove any gradient first
                toggleSwitch.style.removeProperty('background');
                toggleSwitch.style.removeProperty('background-color');
                
                // Set solid gray color
                toggleSwitch.style.background = '#e0e0e0';
                toggleSwitch.style.backgroundColor = '#e0e0e0';
                toggleSwitch.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.1)';
                
                // Use cssText to completely override
                toggleSwitch.style.cssText = 'background: #e0e0e0; background-color: #e0e0e0; box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);';
                
                // Move slider to left
                slider.style.transform = 'translateX(0)';
                slider.style.left = '4px';
                slider.style.boxShadow = '0 3px 8px rgba(0, 0, 0, 0.2)';
                slider.style.cssText += '; transform: translateX(0); left: 4px; box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2);';
                
                console.log('[TOGGLE] ⚪ Set to INACTIVE - Gray');
                console.log('[TOGGLE] Background:', toggleSwitch.style.background);
                console.log('[TOGGLE] Computed background:', window.getComputedStyle(toggleSwitch).background);
            }
            
            // Force a reflow to ensure styles are applied
            void toggleSwitch.offsetHeight;
            
            // Verify the change immediately
            const computedStyle = window.getComputedStyle(toggleSwitch);
            console.log('[TOGGLE] Computed background:', computedStyle.background);
            console.log('[TOGGLE] Computed backgroundColor:', computedStyle.backgroundColor);
            console.log('[TOGGLE] Has active class:', toggleSwitch.classList.contains('active'));
            console.log('[TOGGLE] Slider left position:', window.getComputedStyle(slider).left);
        };
        
        // Click event handler - MULTIPLE METHODS TO ENSURE IT WORKS
        toggleSwitch.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('[TOGGLE] ===== CLICK EVENT FIRED =====');
            console.log('[TOGGLE] Before click - has active class:', toggleSwitch.classList.contains('active'));
            console.log('[TOGGLE] Before click - background style:', toggleSwitch.style.background);
            
            // Toggle sidebar collapse
            leftSidebar.classList.toggle('sidebar-collapsed');
            
            // Get new state
            const isCollapsed = leftSidebar.classList.contains('sidebar-collapsed');
            
            console.log('[TOGGLE] Sidebar collapsed state:', isCollapsed);
            
            // Update toggle switch appearance IMMEDIATELY
            updateToggleAppearance(isCollapsed);
            
            // FORCE style application using requestAnimationFrame for immediate visual update
            requestAnimationFrame(() => {
                updateToggleAppearance(isCollapsed);
                // Force another update after a tiny delay
                setTimeout(() => {
                    updateToggleAppearance(isCollapsed);
                }, 10);
            });
            
            console.log('[TOGGLE] After click - has active class:', toggleSwitch.classList.contains('active'));
            console.log('[TOGGLE] After click - background style:', toggleSwitch.style.background);
            console.log('[TOGGLE] Sidebar collapsed:', isCollapsed);
            
            // Save toggle state to localStorage
            localStorage.setItem('sidebarCollapsed', isCollapsed ? 'true' : 'false');
        });
        
        // ALSO add mousedown and mouseup for better responsiveness
        toggleSwitch.addEventListener('mousedown', function(e) {
            toggleSwitch.style.transform = 'scale(0.95)';
        });
        
        toggleSwitch.addEventListener('mouseup', function(e) {
            toggleSwitch.style.transform = 'scale(1)';
        });
        
        // Add touch support for mobile
        toggleSwitch.addEventListener('touchstart', function(e) {
            e.preventDefault();
            toggleSwitch.click();
        });
        
        console.log('[TOGGLE] Click event listener attached');
        
        // Restore previous state on page load
        const wasCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        if (wasCollapsed && window.innerWidth < 992) {
            leftSidebar.classList.add('sidebar-collapsed');
            updateToggleAppearance(true);
            console.log('[TOGGLE] Restored from localStorage - active state set');
        } else {
            // Ensure initial state is correct - start with inactive
            updateToggleAppearance(false);
        }
        
        // Verify the toggle is visible and styled correctly
        setTimeout(() => {
            const computedStyle = window.getComputedStyle(toggleSwitch);
            console.log('[TOGGLE] ===== FINAL VERIFICATION =====');
            console.log('[TOGGLE] Initial background color:', computedStyle.backgroundColor);
            console.log('[TOGGLE] Initial background:', computedStyle.background);
            console.log('[TOGGLE] Toggle switch is ready!');
            console.log('[TOGGLE] Toggle switch visible:', toggleSwitch.offsetWidth > 0 && toggleSwitch.offsetHeight > 0);
        }, 200);
        
        console.log('[TOGGLE] ✅ Toggle switch initialized successfully');
    }
    
    // Start the setup process
    findAndSetupToggle();
}


// Alert Sound Setup
function setupAlertSound() {
    // Alert sound will be played via Audio API
}

function playAlert() {
    try {
        // Stop any currently playing audio first
        stopAlertSound();
        const audio = new Audio('/static/sounds/alert.mp3');
        currentAlertAudio = audio;
        audio.play().catch(e => console.error('Audio play failed:', e));
    } catch (e) {
        console.error('Alert sound error:', e);
    }
}

function stopAlertSound() {
    // Stop any currently playing alert audio
    if (currentAlertAudio) {
        try {
            currentAlertAudio.pause();
            currentAlertAudio.currentTime = 0;
            currentAlertAudio = null;
        } catch (e) {
            console.error('Error stopping alert sound:', e);
        }
    }
}

// Update Functions
function updateCounts(data) {
    // Ensure valid numbers
    const total = parseInt(data.total || 0) || 0;
    const male = parseInt(data.male || 0) || 0;
    const female = parseInt(data.female || 0) || 0;
    const totalEl = document.getElementById('total-count');
    const maleEl = document.getElementById('male-count');
    const femaleEl = document.getElementById('female-count');
    
    if (totalEl) totalEl.textContent = total;
    if (maleEl) maleEl.textContent = male;
    if (femaleEl) femaleEl.textContent = female;
    
    console.log(`[UI] Updated counts - Total: ${total}, Male: ${male}, Female: ${female}`);

    // Update majority using the parsed numeric values
    let majority = 'Unknown';
    if (male > female) {
        majority = 'Male';
    } else if (female > male) {
        majority = 'Female';
    } else if (total > 0) {
        majority = 'Mixed';
    }
    const majorityLabelEl = document.getElementById('majority-label');
    if (majorityLabelEl) majorityLabelEl.textContent = majority;
}

function updateGenderChart(data) {
    if (genderChart) {
        genderChart.data.datasets[0].data = [data.male || 0, data.female || 0];
        genderChart.update();
    }
}

function checkCrowdStatus(totalCount) {
    const statusDisplay = document.getElementById('status-display');
    if (!statusDisplay) return;
    
    if (crowdLimit === Infinity) {
        statusDisplay.className = 'alert alert-info mb-0';
        statusDisplay.innerHTML = '<i class="fas fa-info-circle me-2"></i>Status: Safe (No Limit)';
        if (isAlerting) {
            isAlerting = false;
            if (alertIntervalId) {
            clearInterval(alertIntervalId);
            alertIntervalId = null;
            }
            stopAlertSound(); // Stop any playing audio
        }
        return;
    }
    
    if (totalCount > crowdLimit) {
        statusDisplay.className = 'alert alert-danger mb-0 alert-pulse';
        statusDisplay.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i>ALERT! Count: ${totalCount} (Limit: ${crowdLimit})`;
        
        if (!isAlerting) {
            isAlerting = true;
            playAlert();
            alertIntervalId = setInterval(playAlert, 2000);
            
            // Show SweetAlert notification
            Swal.fire({
                icon: 'warning',
                title: 'Crowd Limit Exceeded!',
                text: `Current count: ${totalCount} | Limit: ${crowdLimit}`,
                timer: 5000,
                showConfirmButton: true
            });
        }
    } else {
        statusDisplay.className = 'alert alert-success mb-0';
        statusDisplay.innerHTML = `<i class="fas fa-check-circle me-2"></i>Status: Safe (${totalCount}/${crowdLimit})`;
        if (isAlerting) {
            isAlerting = false;
            if (alertIntervalId) {
            clearInterval(alertIntervalId);
            alertIntervalId = null;
            }
            stopAlertSound(); // Stop any playing audio
        }
    }
}

// Ad Popup Functions - IMPROVED
function showAdPopup(ad) {
    console.log('[AD] ========== showAdPopup CALLED ==========');
    console.log('[AD] Ad object:', ad);
    
    if (!ad) {
        console.error('[AD] ERROR: No ad object provided');
        return;
    }
    
    if (!ad.path) {
        console.error('[AD] ERROR: Ad missing path property');
        console.error('[AD] Ad object:', ad);
        // Still try to show with a fallback
        Swal.fire({
            icon: 'info',
            title: ad.name || 'Advertisement',
            text: ad.description || 'Shop now!',
            timer: 5000
        });
        return;
    }
    
    console.log('[AD] ========== DISPLAYING AD ==========');
    console.log('[AD] Name:', ad.name);
    console.log('[AD] Type:', ad.type || 'image');
    console.log('[AD] Path:', ad.path);
    
    // Ensure type is set (default to image)
    const adType = ad.type || (ad.path.toLowerCase().endsWith('.mp4') || ad.path.toLowerCase().endsWith('.webm') ? 'video' : 'image');
    console.log('[AD] Determined type:', adType);
    
    // Use SweetAlert2 for better visibility and video support
    if (adType === 'video') {
        const videoExt = ad.path.toLowerCase().endsWith('.webm') ? 'webm' : 'mp4';
        const videoType = videoExt === 'webm' ? 'video/webm' : 'video/mp4';
        
        Swal.fire({
            title: ad.name || 'Mall Advertisement',
            html: `<div style="text-align: center; display: flex; flex-direction: column; height: 100%; justify-content: space-between;">
                    ${ad.description ? `<p style="margin-bottom: 10px; color: #666; font-size: 0.9rem; font-weight: 500; line-height: 1.4;">${ad.description}</p>` : ''}
                    <div style="flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; margin: 10px 0;">
                    <video id="ad-video" width="100%" height="auto" autoplay muted playsinline 
                               style="max-height: 45vh; max-width: 100%; width: auto; height: auto; object-fit: contain; border-radius: 10px; background: #000; box-shadow: 0 4px 15px rgba(0,0,0,0.3); display: block;">
                        <source src="${ad.path}" type="${videoType}">
                        Your browser does not support the video tag.
                    </video>
                    </div>
                    <p style="margin-top: 10px; margin-bottom: 0; color: #888; font-size: 0.85rem;">🎯 Targeted Advertisement</p>
                   </div>`,
            showConfirmButton: true,
            confirmButtonText: 'Close',
            width: '50%',
            padding: '1.5rem',
            backdrop: true,
            allowOutsideClick: false,
            timer: 15000,  // 15 seconds
            timerProgressBar: true,
            customClass: {
                popup: 'mall-ad-popup',
                confirmButton: 'swal2-confirm'
            },
            didOpen: () => {
                setTimeout(() => {
                    const video = document.getElementById('ad-video');
                    if (video) {
                        video.muted = true;  // Mute for autoplay
                        video.playsInline = true;
                        video.setAttribute('playsinline', '');
                        video.setAttribute('webkit-playsinline', '');
                        
                        video.load();  // Reload video
                        
                        // Force play with multiple attempts
                        const tryPlay = () => {
                            const playPromise = video.play();
                            if (playPromise !== undefined) {
                                playPromise
                                    .then(() => {
                                        console.log('[AD] Video playing successfully');
                                        // Keep muted for autoplay compatibility
                                        video.muted = false;
                                        try {
                                            video.muted = false;  // Try to unmute
                                        } catch (e) {
                                            console.log('[AD] Cannot unmute (browser policy)');
                                        }
                                    })
                                    .catch(error => {
                                        console.error('[AD] Video play error:', error);
                                        // Try muted play as fallback
                                        video.muted = true;
                                        video.play()
                                            .then(() => console.log('[AD] Playing muted'))
                                            .catch(e2 => {
                                                console.error('[AD] All play attempts failed:', e2);
                                                Swal.fire({
                                                    icon: 'warning',
                                                    title: 'Video Playback Issue',
                                                    text: 'Please click play button to start video',
                                                    timer: 3000
                                                });
                                            });
                                    });
                            }
                        };
                        
                        // Try immediately
                        tryPlay();
                        
                        // Also try after video metadata loads
                        video.addEventListener('loadedmetadata', tryPlay);
                        video.addEventListener('canplay', tryPlay);
                    }
                }, 100);
            },
            willClose: () => {
                const video = document.getElementById('ad-video');
                if (video) {
                    video.pause();
                    video.currentTime = 0;
                    video.src = '';
                    video.load();
                }
            }
        });
    } else {
        // Image ad - Mall style
        console.log('[AD] Showing image ad with path:', ad.path);
        
        Swal.fire({
            title: ad.name || 'Mall Advertisement',
            html: `<div style="text-align: center; display: flex; flex-direction: column; height: 100%; justify-content: space-between;">
                    ${ad.description ? `<p style="margin-bottom: 10px; color: #666; font-size: 0.9rem; font-weight: 500; line-height: 1.4;">${ad.description}</p>` : ''}
                    <div style="flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; margin: 10px 0;">
                    <img src="${ad.path}" alt="${ad.name || 'Advertisement'}" 
                             style="max-width: 100%; max-height: 45vh; width: auto; height: auto; object-fit: contain; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); display: block; margin: 0 auto;"
                         onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'400\\' height=\\'300\\'%3E%3Crect fill=\\'%23ddd\\' width=\\'400\\' height=\\'300\\'/%3E%3Ctext x=\\'50%25\\' y=\\'50%25\\' text-anchor=\\'middle\\' dy=\\'.3em\\' fill=\\'%23999\\'%3E${encodeURIComponent(ad.name || 'Advertisement')}%3C/text%3E%3C/svg%3E';">
                    </div>
                    <p style="margin-top: 10px; margin-bottom: 0; color: #888; font-size: 0.85rem;">🎯 Targeted Advertisement | Shop Now!</p>
                   </div>`,
            showConfirmButton: true,
            confirmButtonText: 'Close',
            width: '50%',
            padding: '1.5rem',
            backdrop: true,
            allowOutsideClick: false,
            timer: 15000,  // 15 seconds for mall ads
            timerProgressBar: true,
            customClass: {
                popup: 'mall-ad-popup',
                confirmButton: 'swal2-confirm'
            },
            didOpen: () => {
                console.log('[AD] Image ad popup opened');
            }
        }).then((result) => {
            console.log('[AD] Ad popup closed');
        });
    }
    
    // Also update ad display area
    try {
        updateAdDisplay(ad);
    } catch (e) {
        console.error('[AD] Error updating ad display area:', e);
    }
}

function closeAdPopup() {
    const container = document.getElementById('ad-popup-container');
    if (container) {
        container.style.display = 'none';
        const popup = document.getElementById('ad-popup');
        if (popup) {
            popup.style.animation = 'fadeOutScale 0.3s ease';
            setTimeout(() => {
                popup.remove();
                currentAdPopup = null;
            }, 300);
        }
    }
    if (adDisplayTimeout) {
        clearTimeout(adDisplayTimeout);
        adDisplayTimeout = null;
    }
}

// Analytics Functions
function fetchCounts() {
    fetch('/people_count')
        .then(r => r.json())
        .then(data => {
            updateCounts(data);
            checkCrowdStatus(data.total || 0);
        })
        .catch(e => console.error('Error fetching counts:', e));
}

function fetchAnalytics() {
    fetch('/analytics')
        .then(r => r.json())
        .then(data => {
            updateAnalytics(data);
            // Also update ads shown immediately
            if (data.ad_stats) {
                document.getElementById('ads-shown').textContent = data.ad_stats.total_ads_shown || 0;
            }
        })
        .catch(e => console.error('Error fetching analytics:', e));
}

function updateAnalytics(data) {
    // Update peak count
    if (data.peak_count !== undefined) {
        const peakCountEl = document.getElementById('peak-count');
        if (peakCountEl) {
            peakCountEl.textContent = data.peak_count || 0;
        }
    }
    
    // Update ads shown - ALWAYS update when data is received
    if (data.ad_stats) {
        const adsShownEl = document.getElementById('ads-shown');
        if (adsShownEl) {
            const totalAds = parseInt(data.ad_stats.total_ads_shown || 0) || 0;
            adsShownEl.textContent = totalAds;
            console.log('[ANALYTICS] Updated ads shown to:', totalAds);
        }
        
        // Update ad chart if modal is open
        if (adChart && document.getElementById('analyticsModal').classList.contains('show')) {
            adChart.data.datasets[0].data = [
                parseInt(data.ad_stats.male_ads_shown || 0) || 0,
                parseInt(data.ad_stats.female_ads_shown || 0) || 0
            ];
            adChart.update();
        }
    }
}

function fetchCurrentAd() {
    fetch('/ad/current')
        .then(r => r.json())
        .then(data => {
            if (data.ad) {
                updateAdDisplay(data.ad);
            }
        })
        .catch(e => console.error('Error fetching current ad:', e));
}

function updateAdDisplay(ad) {
    const adArea = document.getElementById('ad-display-area');
    if (!adArea || !ad) return;
    
    adArea.innerHTML = '';
    
    if (ad.type === 'video') {
        const video = document.createElement('video');
        video.src = ad.path;
        video.controls = true;
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.className = 'img-fluid';
        adArea.appendChild(video);
    } else {
        const img = document.createElement('img');
        img.src = ad.path;
        img.alt = ad.name || 'Advertisement';
        img.className = 'img-fluid';
        adArea.appendChild(img);
    }
}

// Update analytics modal with data
function updateAnalyticsModal(data) {
    console.log('[UPDATE_MODAL] Analytics data received:', JSON.stringify(data, null, 2));
    
    if (!data) {
        console.error('[UPDATE_MODAL] No data provided!');
        return;
    }
    
    // Safely extract and parse all values
    const totalDetections = parseInt(data.total_detections || 0) || 0;
    const maleDetections = parseInt(data.male_detections || 0) || 0;
    const femaleDetections = parseInt(data.female_detections || 0) || 0;
    const peakCount = parseInt(data.peak_count || 0) || 0;
    
    // Critical: Extract current counts properly
    const currentCountsObj = data.current_counts || {};
    const currentTotal = parseInt(currentCountsObj.total || 0) || 0;
    const currentMale = parseInt(currentCountsObj.male || 0) || 0;
    const currentFemale = parseInt(currentCountsObj.female || 0) || 0;
    
    // Extract ad stats
    const adStatsObj = data.ad_stats || {};
    const totalAdsShown = parseInt(adStatsObj.total_ads_shown || 0) || 0;
    const maleAdsShown = parseInt(adStatsObj.male_ads_shown || 0) || 0;
    const femaleAdsShown = parseInt(adStatsObj.female_ads_shown || 0) || 0;
    
    console.log('[UPDATE_MODAL] Parsed data:');
    console.log('  Historical - Total: ' + totalDetections + ', Male: ' + maleDetections + ', Female: ' + femaleDetections);
    console.log('  Current - Total: ' + currentTotal + ', Male: ' + currentMale + ', Female: ' + currentFemale);
    console.log('  Ads - Total: ' + totalAdsShown + ', Male: ' + maleAdsShown + ', Female: ' + femaleAdsShown);
    
    // Update analytics table with all values - consistent styling
    const tableBody = document.getElementById('analytics-table');
    if (tableBody) {
        tableBody.innerHTML = `
            <tr>
                <td><strong>Historical Detections</strong></td>
                <td><strong>${totalDetections}</strong></td>
            </tr>
            <tr>
                <td><strong>Male Detections (Historical)</strong></td>
                <td><strong>${maleDetections}</strong></td>
            </tr>
            <tr>
                <td><strong>Female Detections (Historical)</strong></td>
                <td><strong>${femaleDetections}</strong></td>
            </tr>
            <tr>
                <td><strong>Peak Count</strong></td>
                <td><strong>${peakCount}</strong></td>
            </tr>
            <tr style="background-color: #d1ecf1;">
                <td><strong>Current Total People</strong></td>
                <td><strong style="color: #0c5460; font-size: 1.1em;">${currentTotal}</strong></td>
            </tr>
            <tr style="background-color: #d1ecf1;">
                <td><strong>Current Male</strong></td>
                <td><strong style="color: #0c5460; font-size: 1.1em;">${currentMale}</strong></td>
            </tr>
            <tr style="background-color: #d1ecf1;">
                <td><strong>Current Female</strong></td>
                <td><strong style="color: #0c5460; font-size: 1.1em;">${currentFemale}</strong></td>
            </tr>
            <tr style="background-color: #fff3cd;">
                <td><strong>Total Ads Displayed</strong></td>
                <td><strong style="color: #856404; font-size: 1.1em;">${totalAdsShown}</strong></td>
            </tr>
            <tr>
                <td><strong>Male Ads Displayed</strong></td>
                <td><strong>${maleAdsShown}</strong></td>
            </tr>
            <tr>
                <td><strong>Female Ads Displayed</strong></td>
                <td><strong>${femaleAdsShown}</strong></td>
            </tr>
        `;
        console.log('[UPDATE_MODAL] Table updated successfully');
    } else {
        console.error('[UPDATE_MODAL] analytics-table element not found!');
    }
    
    // Update trend chart with detection history
    if (trendChart && data.detection_history && data.detection_history.length > 0) {
        console.log('[UPDATE_MODAL] Detection history available: ' + data.detection_history.length + ' entries');
        const history = data.detection_history.slice(-20); // Last 20 data points
        // Create clearer labels: Show sequential snapshots (1 = oldest, 20 = newest)
        const labels = history.map((_, i) => {
            const num = i + 1;
            if (num === 1) return '1 (Oldest)';
            if (num === history.length) return num + ' (Newest)';
            return num.toString();
        });
        const totalData = history.map(h => parseInt(h.total || 0));
        const maleData = history.map(h => parseInt(h.male || 0));
        const femaleData = history.map(h => parseInt(h.female || 0));
        
        console.log('[UPDATE_MODAL] Updating trend chart with ' + history.length + ' entries');
        console.log('[UPDATE_MODAL] Total data:', totalData);
        console.log('[UPDATE_MODAL] Male data:', maleData);
        console.log('[UPDATE_MODAL] Female data:', femaleData);
        
        trendChart.data.labels = labels;
        trendChart.data.datasets = [
            {
                label: 'Total Count',
                data: totalData,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                tension: 0.4,
                fill: true,
                borderWidth: 2
            },
            {
                label: 'Male',
                data: maleData,
                borderColor: '#2E86AB',
                backgroundColor: 'rgba(46, 134, 171, 0.1)',
                tension: 0.4,
                fill: true,
                borderWidth: 2
            },
            {
                label: 'Female',
                data: femaleData,
                borderColor: '#e74c3c',
                backgroundColor: 'rgba(231, 76, 60, 0.1)',
                tension: 0.4,
                fill: true,
                borderWidth: 2
            }
        ];
        trendChart.update();
        console.log('[UPDATE_MODAL] Trend chart updated');
    } else if (trendChart) {
        console.log('[UPDATE_MODAL] No detection history, creating from current counts');
        // If no history, create sample data from current counts
        const currentTotal = currentTotal || 0;
        const currentMale = currentMale || 0;
        const currentFemale = currentFemale || 0;
        
        trendChart.data.labels = ['Current'];
        trendChart.data.datasets = [
            {
                label: 'Total Count',
                data: [currentTotal],
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                tension: 0.4
            },
            {
                label: 'Male',
                data: [currentMale],
                borderColor: '#2E86AB',
                backgroundColor: 'rgba(46, 134, 171, 0.1)',
                tension: 0.4
            },
            {
                label: 'Female',
                data: [currentFemale],
                borderColor: '#e74c3c',
                backgroundColor: 'rgba(231, 76, 60, 0.1)',
                tension: 0.4
            }
        ];
        trendChart.update();
    }
    
    // Update ad chart with ad statistics
    if (adChart && data.ad_stats) {
        console.log('[UPDATE_MODAL] Updating ad chart with stats:', data.ad_stats);
        
        const maleAds = parseInt(data.ad_stats.male_ads_shown || 0) || 0;
        const femaleAds = parseInt(data.ad_stats.female_ads_shown || 0) || 0;
        
        adChart.data.datasets[0].data = [maleAds, femaleAds];
        adChart.update();
        console.log('[UPDATE_MODAL] Ad chart updated - Male: ' + maleAds + ', Female: ' + femaleAds);
    }
}

function showAnalytics() {
    console.log('[ANALYTICS] showAnalytics called');
    
    const modal = new bootstrap.Modal(document.getElementById('analyticsModal'));
    
    // Request fresh data via SocketIO first
    console.log('[ANALYTICS] Requesting fresh analytics data via SocketIO...');
    socket.emit('request_analytics');
    
    // Also fetch via API as backup
    console.log('[ANALYTICS] Also fetching via HTTP API...');
    fetch('/analytics')
        .then(r => {
            if (!r.ok) throw new Error('Failed to fetch analytics');
            return r.json();
        })
        .then(data => {
            console.log('[ANALYTICS] HTTP API data received:', JSON.stringify(data, null, 2));
            
            if (!data) {
                throw new Error('No data received from analytics endpoint');
            }
            
            // Validate and ensure data structure
            const completeData = {
                total_detections: data.total_detections || 0,
                male_detections: data.male_detections || 0,
                female_detections: data.female_detections || 0,
                peak_count: data.peak_count || 0,
                current_counts: data.current_counts || {total: 0, male: 0, female: 0, children: 0},
                ad_stats: data.ad_stats || {total_ads_shown: 0, male_ads_shown: 0, female_ads_shown: 0},
                detection_history: data.detection_history || []
            };
            
            console.log('[ANALYTICS] Complete data validated:', JSON.stringify(completeData, null, 2));
            
            // Update modal with complete data
            updateAnalyticsModal(completeData);
            
            // Also update the main dashboard analytics
            updateAnalytics(completeData);
            
            // Show the modal
            modal.show();
            
            console.log('[ANALYTICS] Modal displayed with data');
        })
        .catch(e => {
            console.error('[ANALYTICS] Error fetching analytics:', e);
            Swal.fire({
                icon: 'error',
                title: 'Analytics Error',
                text: 'Failed to load analytics data: ' + e.message
            });
        });
}

// Uptime Counter
function startUptimeCounter() {
    setInterval(() => {
        const uptime = Math.floor((Date.now() - startTime) / 1000);
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = uptime % 60;
        
        let uptimeStr = '';
        if (hours > 0) {
            uptimeStr = `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            uptimeStr = `${minutes}m ${seconds}s`;
        } else {
            uptimeStr = `${seconds}s`;
        }
        
        const uptimeEl = document.getElementById('uptime');
        if (uptimeEl) {
            uptimeEl.textContent = uptimeStr;
        }
    }, 1000);
}

// Add fadeOutScale animation
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOutScale {
        from {
            opacity: 1;
            transform: scale(1);
        }
        to {
            opacity: 0;
            transform: scale(0.8);
        }
    }
`;
document.head.appendChild(style);



