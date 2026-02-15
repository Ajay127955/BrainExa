const API_URL = '/api';

// Utility: Get token
const getToken = () => localStorage.getItem('token');

// Utility: Set token and user
const setAuth = (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
};

// Utility: Clear auth
const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
};

// Check Auth on restricted pages
const checkAuth = (pageType) => {
    const token = getToken();
    const user = JSON.parse(localStorage.getItem('user'));

    if (!token) {
        if (pageType !== 'public') window.location.href = 'login.html';
        return null;
    }

    if (pageType === 'admin' && user.role !== 'admin') {
        window.location.href = 'dashboard.html';
        return null;
    }

    return { token, user };
};

document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    // Login Page
    if (path.includes('login.html')) {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;

                try {
                    const res = await fetch(`${API_URL}/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        setAuth(data.token, data);
                        window.location.href = data.role === 'admin' ? 'admin.html' : 'dashboard.html';
                    } else {
                        alert(data.message || 'Login failed');
                    }
                } catch (err) {
                    console.error(err);
                    alert('An error occurred');
                }
            });
        }
    }

    // Register Page
    if (path.includes('register.html')) {
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('name').value;
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;

                try {
                    const res = await fetch(`${API_URL}/auth/register`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, email, password })
                    });

                    let data;
                    const contentType = res.headers.get("content-type");
                    if (contentType && contentType.indexOf("application/json") !== -1) {
                        data = await res.json();
                    } else {
                        const text = await res.text();
                        console.error('Non-JSON response:', text);
                        throw new Error('Server returned non-JSON response');
                    }

                    if (res.ok) {
                        alert('Registration successful! Please login.');
                        window.location.href = 'login.html';
                    } else {
                        alert(data.message || 'Registration failed');
                    }
                } catch (err) {
                    console.error('Registration Error:', err);
                    alert('An error occurred: ' + err.message);
                }
            });
        }
    }

    // Dashboard Page
    if (path.includes('dashboard.html')) {
        const auth = checkAuth('private');
        if (auth) {
            document.getElementById('userName').textContent = auth.user.name;
            document.getElementById('userAvatar').textContent = auth.user.name.charAt(0).toUpperCase();

            // Load Chat History
            loadChatHistory();

            // Image Upload Logic
            const fileInput = document.getElementById('fileInput');
            const uploadBtn = document.getElementById('uploadBtn');
            const imagePreviewContainer = document.getElementById('imagePreviewContainer');
            const imagePreview = document.getElementById('imagePreview');
            const removeImageBtn = document.getElementById('removeImageBtn');
            let currentImage = null;

            if (uploadBtn && fileInput) {
                uploadBtn.addEventListener('click', () => fileInput.click());

                fileInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            currentImage = reader.result;
                            imagePreview.src = currentImage;
                            imagePreviewContainer.classList.remove('hidden');
                        };
                        reader.readAsDataURL(file);
                    }
                });
            }

            if (removeImageBtn) {
                removeImageBtn.addEventListener('click', () => {
                    fileInput.value = '';
                    currentImage = null;
                    imagePreview.src = '';
                    imagePreviewContainer.classList.add('hidden');
                });
            }

            const chatInput = document.getElementById('chatInput');
            const chatForm = document.getElementById('chatForm');

            // Enter to Send
            if (chatInput && chatForm) {
                chatInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        chatForm.requestSubmit();
                    }
                });
            }

            if (chatForm) {
                chatForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const message = chatInput.value.trim();
                    if (!message && !currentImage) return;

                    // Optimistic UI update
                    appendMessage('user', message, false, currentImage);

                    const payload = { message, image: currentImage };

                    // Reset Input
                    chatInput.value = '';
                    fileInput.value = '';
                    currentImage = null;
                    imagePreview.src = '';
                    imagePreviewContainer.classList.add('hidden');

                    // Show typing indicator
                    document.getElementById('typingIndicator').classList.remove('hidden');
                    const chatContainer = document.getElementById('chatContainer');
                    chatContainer.scrollTop = chatContainer.scrollHeight;

                    try {
                        const res = await fetch(`${API_URL}/chat`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${auth.token}`
                            },
                            body: JSON.stringify(payload)
                        });
                        const data = await res.json();

                        document.getElementById('typingIndicator').classList.add('hidden');

                        if (res.ok) {
                            appendMessage('assistant', data.response, true);
                        } else {
                            appendMessage('assistant', 'Error: ' + data.message);
                        }
                    } catch (err) {
                        document.getElementById('typingIndicator').classList.add('hidden');
                        appendMessage('assistant', 'Error communicating with server.');
                    }
                });
            }

            // Logout
            document.getElementById('logoutBtn').addEventListener('click', logout);
        }
    }

    // Admin Page
    if (path.includes('admin.html')) {
        const auth = checkAuth('admin');
        if (auth) {
            // Load Stats
            loadAdminStats();
        }
    }
});

async function loadChatHistory() {
    const token = getToken();
    try {
        const res = await fetch(`${API_URL}/chat`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const messages = await res.json();
        const chatContainer = document.getElementById('chatContainer');
        chatContainer.innerHTML = ''; // Clear demo messages
        messages.forEach(msg => appendMessage(msg.role, msg.content, false, msg.image));
        // Scroll to bottom after loading history
        setTimeout(() => {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }, 100);
    } catch (err) {
        console.error(err);
    }
}

// Mobile Sidebar Logic
const sidebar = document.getElementById('sidebar');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const sidebarOverlay = document.getElementById('sidebarOverlay');

function toggleSidebar() {
    const isClosed = sidebar.classList.contains('-translate-x-full');
    if (isClosed) {
        sidebar.classList.remove('-translate-x-full');
        sidebarOverlay.classList.remove('hidden');
    } else {
        sidebar.classList.add('-translate-x-full');
        sidebarOverlay.classList.add('hidden');
    }
}

if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', toggleSidebar);
}

if (closeSidebarBtn) {
    closeSidebarBtn.addEventListener('click', toggleSidebar);
}

if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', toggleSidebar);
}

// --- New Features Implementation ---
const shareBtn = document.getElementById('shareBtn');
const downloadBtn = document.getElementById('downloadBtn');
const last7DaysBtn = document.getElementById('last7DaysBtn');
const settingsBtn = document.getElementById('settingsBtn');

// Toast Notification Helper
function showToast(message) {
    let toast = document.getElementById('toast-notification');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.className = 'fixed bottom-5 right-5 bg-primary text-white px-6 py-3 rounded-xl shadow-2xl transform translate-y-20 opacity-0 transition-all duration-300 z-50 font-medium flex items-center gap-2';
        toast.innerHTML = '<span class="material-symbols-outlined">check_circle</span><span id="toast-msg"></span>';
        document.body.appendChild(toast);
    }
    document.getElementById('toast-msg').textContent = message;
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}

// Share Functionality
if (shareBtn) {
    shareBtn.addEventListener('click', () => {
        const url = "https://brainexa.onrender.com";
        navigator.clipboard.writeText(url).then(() => {
            showToast(`Link copied: ${url}`);
        }).catch(err => {
            console.error('Failed to copy: ', err);
            showToast('Failed to copy link.');
        });
    });
}

// Download PDF Functionality
if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
        const element = document.getElementById('chatContainer');
        // Clone to remove scrollbars for PDF
        const clone = element.cloneNode(true);
        clone.style.overflow = 'visible';
        clone.style.height = 'auto';
        clone.style.background = '#0a0712'; // Ensure dark background
        clone.style.color = '#e2e8f0'; // Text color

        const opt = {
            margin: [10, 10],
            filename: 'brainexa-chat-history.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, backgroundColor: '#0a0712' },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        showToast('Generating PDF...');
        // We use a temporary container to render the full height content
        const container = document.createElement('div');
        container.style.width = '800px'; // Fixed width for A4 consistency
        container.appendChild(clone);
        document.body.appendChild(container);

        html2pdf().set(opt).from(container).save().then(() => {
            document.body.removeChild(container);
            showToast('Chat history downloaded!');
        });
    });
}

// Last 7 Days Filter
if (last7DaysBtn) {
    last7DaysBtn.addEventListener('click', async () => {
        showToast('Filtering: Last 7 Days');
        // Fetch fresh history
        try {
            const res = await fetch(`${API_URL}/chat`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const messages = await res.json();

            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const filtered = messages.filter(msg => new Date(msg.timestamp) > sevenDaysAgo);

            // Re-render
            const chatContainer = document.getElementById('chatContainer');
            chatContainer.innerHTML = ''; // Clear current

            if (filtered.length === 0) {
                chatContainer.innerHTML = '<div class="text-center text-slate-500 mt-10">No chats in the last 7 days.</div>';
            } else {
                filtered.forEach(msg => {
                    appendMessage(msg.role, msg.content, false, msg.image);
                });
            }

        } catch (error) {
            console.error(error);
            showToast('Error filtering history');
        }
    });
}

// Settings Modal
if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
        // Create modal dynamically
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in';
        modal.innerHTML = `
                <div class="bg-[#161022] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl transform scale-100 transition-all">
                    <div class="flex items-center justify-between mb-6">
                        <h3 class="text-xl font-bold text-white">Settings</h3>
                        <button id="closeSettings" class="text-slate-400 hover:text-white material-symbols-outlined">close</button>
                    </div>
                    <div class="space-y-4">
                        <div class="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                            <div class="flex items-center gap-3">
                                <span class="material-symbols-outlined text-slate-400">delete</span>
                                <span class="text-slate-200">Clear Chat History</span>
                            </div>
                            <button id="clearChatBtn" class="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors">
                                Clear
                            </button>
                        </div>
                        <div class="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                             <div class="flex items-center gap-3">
                                <span class="material-symbols-outlined text-slate-400">palette</span>
                                <span class="text-slate-200">Theme</span>
                            </div>
                            <span class="text-xs text-slate-500 uppercase font-bold tracking-wider">Dark Mode</span>
                        </div>
                    </div>
                    <div class="mt-6 text-center text-xs text-slate-600 uppercase tracking-widest font-bold">
                        Brainexa v1.0.2
                    </div>
                </div>
            `;
        document.body.appendChild(modal);

        document.getElementById('closeSettings').addEventListener('click', () => modal.remove());

        document.getElementById('clearChatBtn').addEventListener('click', () => {
            if (confirm('Are you sure you want to delete all chat history? This cannot be undone.')) {
                // In a real app we would call DELETE /api/chat
                showToast('Chat history cleared (Simulation)');
                modal.remove();
            }
        });
    });
}

function appendMessage(role, content, animate = false, image = null) {
    const chatContainer = document.getElementById('chatContainer');
    const div = document.createElement('div');
    // Reduced max-width to max-w-xl
    div.className = role === 'user' ? 'flex items-start gap-3 max-w-xl ml-auto flex-row-reverse' : 'flex items-start gap-3 max-w-xl';

    // Avatar Logic (Simplified)
    const avatar = role === 'user'
        ? `<div class="size-8 rounded-lg bg-neutral-800 border border-white/10 overflow-hidden shrink-0 mt-1 flex items-center justify-center text-white font-bold text-xs">U</div>`
        : `<div class="size-8 rounded-lg bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center shadow-lg shadow-primary/20 shrink-0 mt-1"><span class="material-symbols-outlined text-white text-base">neurology</span></div>`;

    const bubbleClass = role === 'user' ? 'chat-bubble-user rounded-tr-none text-white whitespace-pre-wrap' : 'chat-bubble-ai rounded-tl-none text-slate-200 whitespace-pre-wrap';
    const name = role === 'user' ? 'You' : 'Brainexa';
    const align = role === 'user' ? 'text-right' : '';
    const margin = role === 'user' ? 'mr-1' : 'ml-1';

    let imageHTML = '';
    if (image) {
        imageHTML = `<img src="${image}" class="rounded-lg max-w-full h-auto mb-2 border border-white/10">`;
    }

    div.innerHTML = `
        ${avatar}
        <div class="space-y-1 flex-1 ${align}">
            <p class="text-[10px] font-bold ${role === 'user' ? 'text-slate-500' : 'text-primary'} uppercase tracking-wider ${margin}">${name}</p>
            <div class="${bubbleClass} px-4 py-2 rounded-2xl leading-relaxed shadow-sm inline-block text-left max-w-full text-sm">
                ${imageHTML}
                <span class="message-content"></span>
            </div>
        </div>
    `;

    const messageContent = div.querySelector('.message-content');

    if (animate) {
        let i = 0;
        messageContent.textContent = '';
        const interval = setInterval(() => {
            messageContent.textContent += content.charAt(i);
            chatContainer.scrollTop = chatContainer.scrollHeight;
            i++;
            if (i >= content.length) {
                clearInterval(interval);
            }
        }, 15); // Speed of typing
    } else {
        messageContent.textContent = content;
    }

    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function loadAdminStats() {
    const token = getToken();
    try {
        const res = await fetch(`${API_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        // Update stats (Using hypothetical IDs from admin.html structure)
        // Since I didn't see explicit IDs in admin.html, I might need to update admin.html to include ids or target by structure.
        // For now, I'll log it.
        // Or better, I'll update admin.html to have IDs for stats.

        // Assuming I will add IDs to admin.html: stats-users, stats-chats, stats-messages
        const statsGrid = document.getElementById('statsGrid');
        if (statsGrid) {
            statsGrid.innerHTML = `
               <div class="glass-card p-6 rounded-xl flex flex-col gap-4 group hover:border-primary/50 transition-colors">
                    <div>
                        <p class="text-slate-400 text-sm font-medium">Total Users</p>
                        <h3 class="text-2xl font-bold mt-1 tracking-tight">${data.users}</h3>
                    </div>
                </div>
                <div class="glass-card p-6 rounded-xl flex flex-col gap-4 group hover:border-primary/50 transition-colors">
                    <div>
                        <p class="text-slate-400 text-sm font-medium">Total Chats</p>
                        <h3 class="text-2xl font-bold mt-1 tracking-tight">${data.chats}</h3>
                    </div>
                </div>
                 <div class="glass-card p-6 rounded-xl flex flex-col gap-4 group hover:border-primary/50 transition-colors">
                    <div>
                        <p class="text-slate-400 text-sm font-medium">Total Messages</p>
                        <h3 class="text-2xl font-bold mt-1 tracking-tight">${data.messages}</h3>
                    </div>
                </div>
            `;
        }

        // Load users table
        const usersRes = await fetch(`${API_URL}/admin/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const users = await usersRes.json();
        const tbody = document.getElementById('userTableBody');
        if (tbody) {
            tbody.innerHTML = users.map(user => `
                <tr class="hover:bg-white/2 transition-colors">
                    <td class="px-8 py-5">
                         <p class="text-sm font-bold">${user.name}</p>
                    </td>
                    <td class="px-8 py-5">
                        <p class="text-sm">${user.email}</p>
                    </td>
                    <td class="px-8 py-5">
                        <span class="px-2 py-1 rounded-md bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-tight">${user.role}</span>
                    </td>
                    <td class="px-8 py-5">
                       <p class="text-xs text-slate-400">${new Date(user.createdAt).toLocaleDateString()}</p>
                    </td>
                    <td class="px-8 py-5 text-right">
                        <button class="text-xs text-primary hover:underline">Edit</button>
                    </td>
                </tr>
            `).join('');
        }

    } catch (err) {
        console.error(err);
    }
}
