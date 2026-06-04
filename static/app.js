// ====================================================
// FINRAG INTERACTIVE FRONTEND APPLICATION LOGIC
// ====================================================

document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const chatRoll = document.getElementById("chat-roll");
    const chatInput = document.getElementById("chat-input");
    const btnSend = document.getElementById("btn-send");
    const btnResetChat = document.getElementById("btn-reset-chat");
    const chatSessionId = document.getElementById("chat-session-id");
    
    // Status Indicators
    const statusBrain = document.getElementById("status-brain");
    const statusKb = document.getElementById("status-kb");
    const statusSmtp = document.getElementById("status-smtp");
    
    // Market Watch elements
    const stockPrice = document.getElementById("stock-price");
    const stockChange = document.getElementById("stock-change");
    const stockPrev = document.getElementById("stock-prev");
    
    // Classroom mock controls
    const mockPriceInput = document.getElementById("mock-price-input");
    const btnTriggerAlert = document.getElementById("btn-trigger-alert");
    
    // Suggestion Chips
    const suggestionChips = document.querySelectorAll(".suggestion-chip");

    // Local application state
    let threadId = "";
    
    // ==========================================
    // INITIALIZATION & API GETTERS
    // ==========================================
    
    // Reset/Retrieve active thread session from FastAPI backend
    async function initSession() {
        try {
            const res = await fetch("/api/reset", { method: "POST" });
            const data = await res.json();
            threadId = data.thread_id;
            chatSessionId.textContent = threadId.substring(23); // Display dynamic short session ID
            
            // Render welcoming message
            renderWelcomeMessage();
            
            // Sync status panel and market price
            await syncSystemStatus();
            await fetchNVDAStockData();
        } catch (err) {
            console.error("Session initialization failed:", err);
            appendSystemMessage("Error initializing connection. Is the python backend server running?");
        }
    }

    // Sync metadata dashboard fields
    async function syncSystemStatus() {
        try {
            const res = await fetch("/api/status");
            const data = await res.json();
            
            // Update Sidebar status indicators
            statusBrain.innerHTML = `<span style="color:var(--primary-accent)"><i class="fa-solid fa-brain"></i> ${data.model_loaded}</span>`;
            statusKb.innerHTML = `<span style="color:var(--secondary-accent)"><i class="fa-solid fa-database"></i> ${data.chunks_indexed} Chunks</span>`;
            statusSmtp.innerHTML = `<span style="font-size:11px; color: ${data.smtp_status.includes('Active') ? 'var(--primary-accent)' : 'var(--text-neutral)'}"><i class="fa-solid fa-envelope"></i> ${data.smtp_status}</span>`;
        } catch (err) {
            console.error("Failed to sync system status:", err);
        }
    }

    // Load NVIDIA stock ticker values dynamically
    async function fetchNVDAStockData(mockPrice = null) {
        try {
            let url = "/api/stock";
            if (mockPrice !== null) {
                url += `?mock_price=${parseFloat(mockPrice)}`;
            }
            const res = await fetch(url);
            const data = await res.json();
            
            stockPrice.textContent = `$${data.current_price.toFixed(2)}`;
            stockPrev.textContent = `$${data.previous_close.toFixed(2)}`;
            
            const changePercent = data.change_percent;
            
            // Render positive/negative indicators in sidebar
            if (changePercent >= 0) {
                stockChange.className = "stock-change text-positive";
                stockChange.textContent = `+${changePercent.toFixed(2)}%`;
            } else {
                stockChange.className = "stock-change text-negative";
                stockChange.textContent = `${changePercent.toFixed(2)}%`;
            }
        } catch (err) {
            console.error("Failed to fetch yFinance data:", err);
        }
    }

    // ==========================================
    // RENDER FUNCTIONS
    // ==========================================

    // Print welcome presentation from agent
    function renderWelcomeMessage() {
        chatRoll.innerHTML = "";
        
        const welcomeMessageHTML = `
            <div class="message agent">
                <span class="message-sender">FinRAG Agent</span>
                <div class="bubble">
                    Hello! I am your elite financial AI assistant specialized in NVIDIA (NVDA) historical reports and stock market analysis.
                    <br><br>
                    I have direct access to Q1-Q3 and Annual 2025 financial PDFs (via local ChromaDB RAG), real-time stock prices (via yFinance), and SMTP alert delivery.
                    <br><br>
                    How can I assist you with your NVIDIA financial analysis today?
                </div>
            </div>
        `;
        chatRoll.innerHTML = welcomeMessageHTML;
        scrollToBottom();
    }

    // Render message bubbles dynamically with appropriate styling
    function appendMessage(sender, text) {
        const messageDiv = document.createElement("div");
        messageDiv.className = `message ${sender}`;
        
        // Convert double newlines to breaks for clean formatting
        const formattedText = text.replace(/\n/g, "<br>");
        
        messageDiv.innerHTML = `
            <span class="message-sender">${sender === "user" ? "You" : "FinRAG Agent"}</span>
            <div class="bubble">${formattedText}</div>
        `;
        
        chatRoll.appendChild(messageDiv);
        scrollToBottom();
    }

    // Append standard loader/system warnings
    let thinkingIndicator = null;
    
    function showThinkingIndicator() {
        removeThinkingIndicator();
        thinkingIndicator = document.createElement("div");
        thinkingIndicator.className = "system-status-msg";
        thinkingIndicator.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> FinRAG Agent is thinking...`;
        chatRoll.appendChild(thinkingIndicator);
        scrollToBottom();
    }

    function removeThinkingIndicator() {
        if (thinkingIndicator && thinkingIndicator.parentNode) {
            thinkingIndicator.parentNode.removeChild(thinkingIndicator);
        }
        thinkingIndicator = null;
    }

    function appendSystemMessage(text) {
        const sysDiv = document.createElement("div");
        sysDiv.className = "system-status-msg";
        sysDiv.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${text}`;
        chatRoll.appendChild(sysDiv);
        scrollToBottom();
    }

    function scrollToBottom() {
        chatRoll.scrollTop = chatRoll.scrollHeight;
    }

    // ==========================================
    // CHAT & EVENTS EXECUTOR
    // ==========================================

    // POST query to FastAPI backend chat endpoint
    async function sendQuery(queryText) {
        const text = queryText.trim();
        if (!text) return;
        
        // Add User message immediately
        appendMessage("user", text);
        chatInput.value = "";
        
        // Lock controls during thinking state
        chatInput.disabled = true;
        btnSend.disabled = true;
        showThinkingIndicator();
        
        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text, thread_id: threadId })
            });
            
            const data = await res.json();
            removeThinkingIndicator();
            
            if (res.ok) {
                // Render Agent Response
                appendMessage("agent", data.answer);
                
                // If query simulated an alert, sync the Stock card in the sidebar dynamically!
                if (text.includes("$")) {
                    const priceMatch = text.match(/\$?([0-9]+(\.[0-9]+)?)/);
                    if (priceMatch && priceMatch[1]) {
                        await fetchNVDAStockData(priceMatch[1]);
                    }
                } else {
                    await fetchNVDAStockData(); // Refresh current yFinance details
                }
                
                // Sync SMTP status or indicators if updated
                await syncSystemStatus();
            } else {
                appendSystemMessage(`Error: ${data.detail || 'Could not fetch response.'}`);
            }
        } catch (err) {
            removeThinkingIndicator();
            console.error("Chat request failed:", err);
            appendSystemMessage("Failed to reach server. Please check FastAPI backend logs.");
        } finally {
            chatInput.disabled = false;
            btnSend.disabled = false;
            chatInput.focus();
        }
    }

    // Send Button click
    btnSend.addEventListener("click", () => {
        sendQuery(chatInput.value);
    });

    // Enter press inside input field
    chatInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            sendQuery(chatInput.value);
        }
    });

    // Suggestion chips click
    suggestionChips.forEach(chip => {
        chip.addEventListener("click", () => {
            const query = chip.getAttribute("data-query");
            sendQuery(query);
        });
    });

    // Mock alert trigger button
    btnTriggerAlert.addEventListener("click", () => {
        const mockPrice = mockPriceInput.value.trim();
        if (!mockPrice) {
            alert("Please enter a valid mock price value.");
            return;
        }
        
        const queryText = `Check NVDA price, but pretend it is $${mockPrice}`;
        sendQuery(queryText);
    });

    // Reset conversational session memory
    btnResetChat.addEventListener("click", async () => {
        if (confirm("Are you sure you want to reset conversational memory and start a new session?")) {
            await initSession();
            appendSystemMessage("Chat memory successfully reset. New session started.");
        }
    });

    // Start App!
    initSession();
});
