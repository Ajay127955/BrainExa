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
                    const data = await res.json();
                    if (res.ok) {
                        alert('Registration successful! Please login.');
                        window.location.href = 'login.html';
                    } else {
                        alert(data.message || 'Registration failed');
                    }
                } catch (err) {
                    console.error(err);
                    alert('An error occurred');
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
