/**
 * Production-Grade Embeddable Support Ticket Widget
 * 
 * Features:
 * - File attachment support (up to 5 files, 10MB each)
 * - View tickets by email
 * - Real-time chat messaging (Supabase realtime or polling fallback)
 * - Chat popup for ticket conversations
 * - Auto-fill user information from config
 * - Production-level error handling
 * - Modern, responsive design with system fonts
 * - Accessible and user-friendly
 * 
 * Usage:
 * <script src="https://your-domain.com/support-widget.js"></script>
 * <script>
 *   SupportWidget.init({
 *     apiUrl: 'https://your-api-domain.com/api/public/customer-support',
 *     apiKey: 'your-api-key-here', // Optional
 *     buttonText: 'Contact Support',
 *     position: 'bottom-right', // bottom-right, bottom-left, top-right, top-left
 *     // Optional: User information for auto-fill
 *     userId: 'user-123', // Optional: User ID
 *     userName: 'John Doe', // Optional: User name (auto-fills form, disabled if provided)
 *     userEmail: 'user@example.com', // Optional: User email (auto-fills form and tickets search, disabled if provided)
 *     // Optional: Supabase config for real-time messaging
 *     supabaseUrl: 'https://your-project.supabase.co', // Optional: For realtime messaging
 *     supabaseKey: 'your-anon-key' // Optional: For realtime messaging
 *   });
 * </script>
 */

(function(window, document) {
  'use strict';

  const SupportWidget = {
    config: {
      apiUrl: '',
      apiKey: null,
      buttonText: 'Contact Support',
      position: 'bottom-right',
      zIndex: 9999,
      userId: null, // Optional: User ID
      userName: null, // Optional: User name for auto-fill
      userEmail: null // Optional: User email for auto-fill
    },

    isOpen: false,
    currentView: 'form', // 'form', 'tickets', or 'chat'
    selectedFiles: [],
    uploadedFileUrls: [], // Store uploaded file URLs
    uploadedFilePaths: [], // Store uploaded file paths for deletion
    uploadedFileMetadata: [], // Store file metadata (name, size, type)
    ticketId: null, // Store ticket ID from first file upload (UUID)
    // Chat popup state
    currentTicketId: null, // Currently open ticket for chat
    currentTicket: null, // Ticket details
    ticketMessages: [], // Array of messages for current ticket
    realtimeSubscription: null, // Supabase subscription object
    // Chat attachments state
    chatSelectedFiles: [], // Files selected for chat message
    chatUploadedAttachments: [], // Uploaded attachment data for current message
    messagePollInterval: null, // Polling interval ID (fallback if no Supabase)
    supabaseClient: null, // Supabase client instance
    loadedTickets: [], // Store loaded tickets for click handling
    currentTicketsEmail: null, // Email used to load current tickets list
    isSubmitting: false, // Flag to prevent multiple simultaneous submissions

    /**
     * Initialize the widget
     */
    init: function(options) {
      if (typeof options !== 'object') {
        console.error('SupportWidget: Options must be an object');
        return;
      }

      this.config = Object.assign({}, this.config, options);

      if (!this.config.apiUrl) {
        console.error('SupportWidget: apiUrl is required');
        return;
      }

      // Initialize Supabase client if URL and key provided
      if (this.config.supabaseUrl && this.config.supabaseKey) {
        this.initSupabase();
      }

      // Inject styles FIRST to ensure fonts load before creating DOM elements
      this.injectStyles();
      this.createButton();
      this.createModal();
      console.log('✅ Support Widget initialized');
    },

    /**
     * Initialize Supabase client for realtime
     */
    initSupabase: function() {
      // Dynamically load Supabase JS from CDN
      if (typeof window.supabase !== 'undefined') {
        // Supabase already loaded
        this.supabaseClient = window.supabase.createClient(this.config.supabaseUrl, this.config.supabaseKey);
        console.log('✅ Supabase client initialized (already loaded)');
        return;
      }

      // Load Supabase from CDN
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      script.onload = () => {
        if (window.supabase) {
          this.supabaseClient = window.supabase.createClient(this.config.supabaseUrl, this.config.supabaseKey);
          console.log('✅ Supabase client initialized');
        }
      };
      script.onerror = () => {
        console.warn('⚠️ Failed to load Supabase. Realtime features will use polling fallback.');
      };
      document.head.appendChild(script);
    },

    /**
     * Create floating button
     */
    createButton: function() {
      const button = document.createElement('button');
      button.id = 'support-widget-button';
      button.setAttribute('aria-label', this.config.buttonText);
      button.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <span>${this.config.buttonText}</span>
      `;
      button.className = `support-widget-btn support-widget-btn-${this.config.position}`;
      button.onclick = () => this.toggleModal();
      document.body.appendChild(button);
    },

    /**
     * Create modal with form and ticket viewer
     */
    createModal: function() {
      const modal = document.createElement('div');
      modal.id = 'support-widget-modal';
      modal.className = 'support-widget-modal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-labelledby', 'support-widget-title');
      modal.innerHTML = `
        <div class="support-widget-overlay" onclick="SupportWidget.closeModal()"></div>
        <div class="support-widget-content">
          <div class="support-widget-header">
            <h2 id="support-widget-title">Contact Support</h2>
            <button class="support-widget-close" onclick="SupportWidget.closeModal()" aria-label="Close">&times;</button>
          </div>
          <div class="support-widget-body">
            <!-- Form View -->
            <div id="support-widget-form-view" class="support-widget-view">
              <form id="support-widget-form" class="support-widget-form">
                <div class="support-widget-field">
                  <label for="support-name">Name *</label>
                  <input type="text" id="support-name" name="name" required autocomplete="name">
                </div>
                <div class="support-widget-field">
                  <label for="support-email">Email *</label>
                  <input type="email" id="support-email" name="email" required autocomplete="email">
                </div>
                <div class="support-widget-field">
                  <label for="support-subject">Subject *</label>
                  <input type="text" id="support-subject" name="subject" required maxlength="255">
                  <div class="support-widget-char-count">
                    <span id="support-subject-count">0/255</span> characters
                  </div>
                </div>
                <div class="support-widget-field">
                  <label for="support-category">Category</label>
                  <select id="support-category" name="category">
                    <option value="general">General</option>
                    <option value="technical">Technical</option>
                    <option value="billing">Billing</option>
                    <option value="feature_request">Feature Request</option>
                    <option value="bug_report">Bug Report</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div class="support-widget-field">
                  <label for="support-message">Message *</label>
                  <textarea id="support-message" name="message" rows="5" required placeholder="Please describe your issue in detail..." maxlength="5000"></textarea>
                  <div class="support-widget-char-count">
                    <span id="support-message-count">0/5000</span> characters
                  </div>
                </div>
                <div class="support-widget-field">
                  <label for="support-priority">Priority</label>
                  <select id="support-priority" name="priority">
                    <option value="low">Low</option>
                    <option value="medium" selected>Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div class="support-widget-field">
                  <label>Attachments (Optional, max 5 files, 10MB each)</label>
                  <div class="support-widget-file-upload">
                    <input type="file" id="support-files" name="files" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" style="display: none;">
                    <button type="button" class="support-widget-file-btn" onclick="document.getElementById('support-files').click()">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                      Choose Files
                    </button>
                    <div id="support-widget-file-list" class="support-widget-file-list"></div>
                  </div>
                </div>
                <div id="support-widget-message" class="support-widget-message"></div>
                <div class="support-widget-actions">
                  <button type="button" onclick="SupportWidget.showTicketsView()">View My Tickets</button>
                  <button type="button" onclick="SupportWidget.closeModal()">Cancel</button>
                  <button type="submit" id="support-widget-submit">Submit Ticket</button>
                </div>
              </form>
            </div>
            <!-- Tickets View -->
            <div id="support-widget-tickets-view" class="support-widget-view" style="display: none;">
              <div class="support-widget-tickets-header">
                <h3>My Support Tickets</h3>
                <button type="button" onclick="SupportWidget.showFormView()" class="support-widget-back-btn">← New Ticket</button>
              </div>
              <div class="support-widget-tickets-search">
                <input type="email" id="support-tickets-email" placeholder="Enter your email address" required>
                <button type="button" onclick="SupportWidget.loadTickets()">View Tickets</button>
              </div>
              <div id="support-widget-tickets-list" class="support-widget-tickets-list"></div>
            </div>
            <!-- Chat View -->
            <div id="support-widget-chat-view" class="support-widget-view" style="display: none;">
              <div class="support-widget-chat-header">
                <button type="button" onclick="SupportWidget.closeChatPopup()" class="support-widget-back-btn">← Back</button>
                <div class="support-widget-chat-title">
                  <h3 id="support-widget-chat-ticket-number">Ticket #</h3>
                  <span id="support-widget-chat-status" class="support-widget-ticket-status"></span>
                </div>
              </div>
              <div id="support-widget-chat-subject" class="support-widget-chat-subject"></div>
              <div id="support-widget-chat-messages" class="support-widget-chat-messages"></div>
              <div class="support-widget-chat-input-area">
                <div id="support-widget-chat-error" class="support-widget-message"></div>
                <div id="support-widget-chat-file-list" class="support-widget-chat-file-list" style="display: none;"></div>
                <textarea id="support-widget-chat-input" placeholder="Type your message..." rows="3" maxlength="5000"></textarea>
                <div class="support-widget-chat-input-footer">
                  <div class="support-widget-chat-input-actions">
                    <input type="file" id="support-widget-chat-files" multiple accept="image/*,.svg,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" style="display: none;">
                    <button type="button" class="support-widget-chat-attach-btn" onclick="document.getElementById('support-widget-chat-files').click()" title="Attach files">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                      </svg>
                    </button>
                    <span id="support-widget-chat-char-count" class="support-widget-char-count">0/5000</span>
                  </div>
                  <button type="button" id="support-widget-chat-send" onclick="SupportWidget.sendChatMessage()">Send</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      // Handle form submission
      const form = document.getElementById('support-widget-form');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.submitTicket();
      });

      // Add real-time validation on blur
      const fields = ['name', 'email', 'subject', 'message'];
      fields.forEach(fieldName => {
        const field = document.getElementById(`support-${fieldName}`);
        if (field) {
          field.addEventListener('blur', () => {
            this.validateField(fieldName);
          });
          field.addEventListener('input', () => {
            // Clear error on input
            if (field.classList.contains('support-widget-field-error')) {
              const errorDiv = field.parentElement.querySelector('.support-widget-field-error-message');
              if (errorDiv) {
                errorDiv.remove();
                field.classList.remove('support-widget-field-error');
              }
            }
            // Update character count
            this.updateCharCount(fieldName);
          });
        }
      });

      // Initialize character counts
      this.updateCharCount('subject');
      this.updateCharCount('message');

      // Handle chat input (add listeners after a short delay to ensure DOM is ready)
      setTimeout(() => {
        const chatInput = document.getElementById('support-widget-chat-input');
        if (chatInput) {
          chatInput.addEventListener('input', () => {
            this.updateCharCount('chat-input');
          });
          chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              this.sendChatMessage();
            }
          });
        }
        
        // Handle chat file selection
        const chatFileInput = document.getElementById('support-widget-chat-files');
        if (chatFileInput) {
          chatFileInput.addEventListener('change', (e) => {
            this.handleChatFileSelection(e.target.files);
          });
        }
      }, 100);

      // Handle file selection
      const fileInput = document.getElementById('support-files');
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.handleFileSelection(e.target.files);
        }
        // Reset input to allow selecting same file again
        e.target.value = '';
      });
    },

    /**
     * Handle file selection and upload immediately
     */
    handleFileSelection: function(files) {
      const newFiles = Array.from(files).slice(0, 5); // Max 5 files
      const fileList = document.getElementById('support-widget-file-list');

      if (newFiles.length === 0) return;

      // Validate and upload each file
      newFiles.forEach((file, index) => {
        if (file.size > 10 * 1024 * 1024) {
          this.showError(`File "${file.name}" exceeds 10MB limit`);
          return;
        }

        // Add file to selected files
        const fileIndex = this.selectedFiles.length;
        this.selectedFiles.push(file);
        this.uploadedFileUrls.push(null); // Placeholder for URL
        this.uploadedFilePaths.push(null); // Placeholder for path
        this.uploadedFileMetadata.push({
          name: file.name,
          size: file.size,
          type: file.type
        }); // Store file metadata

        // Create file item with upload status
        const fileItem = document.createElement('div');
        fileItem.id = `support-file-item-${fileIndex}`;
        fileItem.className = 'support-widget-file-item';
        fileItem.innerHTML = `
          <div class="support-widget-file-info">
            <span class="support-widget-file-name">${file.name}</span>
            <span class="support-widget-file-size">${this.formatFileSize(file.size)}</span>
          </div>
          <div class="support-widget-file-status">
            <span class="support-widget-upload-status" id="support-upload-status-${fileIndex}">Uploading...</span>
            <div class="support-widget-upload-progress" id="support-upload-progress-${fileIndex}">
              <div class="support-widget-progress-bar"></div>
            </div>
          </div>
          <button type="button" class="support-widget-file-remove" onclick="SupportWidget.removeFile(${fileIndex})" aria-label="Remove file" style="display: none;">&times;</button>
        `;
        fileList.appendChild(fileItem);

        // Upload file immediately
        this.uploadFile(file, fileIndex);
      });
    },

    /**
     * Upload file to bucket and get URL
     */
    uploadFile: function(file, fileIndex) {
      const statusElement = document.getElementById(`support-upload-status-${fileIndex}`);
      const progressElement = document.getElementById(`support-upload-progress-${fileIndex}`);
      const progressBar = progressElement.querySelector('.support-widget-progress-bar');
      const fileItem = document.getElementById(`support-file-item-${fileIndex}`);
      const removeBtn = fileItem.querySelector('.support-widget-file-remove');

      const formData = new FormData();
      formData.append('file', file);

      // Create XMLHttpRequest for upload progress
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          progressBar.style.width = percentComplete + '%';
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            if (response.success && response.data.file_url) {
              // Store the URL and path
              // Prefer public URL if available (more reliable)
              const fileUrl = response.data.file_url_public || response.data.file_url;
              this.uploadedFileUrls[fileIndex] = fileUrl;
              this.uploadedFilePaths[fileIndex] = response.data.file_path;
              
              // Update metadata with file_name from response if available
              if (response.data.file_name && this.uploadedFileMetadata[fileIndex]) {
                this.uploadedFileMetadata[fileIndex].name = response.data.file_name;
              }
              if (response.data.file_size && this.uploadedFileMetadata[fileIndex]) {
                this.uploadedFileMetadata[fileIndex].size = response.data.file_size;
              }
              if (response.data.file_type && this.uploadedFileMetadata[fileIndex]) {
                this.uploadedFileMetadata[fileIndex].type = response.data.file_type;
              }
              
              // Store ticket_id from first file upload (all files from same upload share same ticket_id)
              if (response.data.ticket_id && !this.ticketId) {
                this.ticketId = response.data.ticket_id;
              }
              
              // Update UI to show success
              statusElement.textContent = 'Uploaded ✓';
              statusElement.className = 'support-widget-upload-status support-widget-upload-success';
              progressBar.style.width = '100%';
              progressBar.className = 'support-widget-progress-bar support-widget-progress-complete';
              removeBtn.style.display = 'flex';
              
              // Hide progress bar after a moment
              setTimeout(() => {
                progressElement.style.display = 'none';
              }, 1000);
            } else {
              throw new Error(response.error?.message || 'Upload failed');
            }
          } catch (error) {
            this.handleUploadError(fileIndex, error.message || 'Failed to parse response');
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            this.handleUploadError(fileIndex, error.error?.message || 'Upload failed');
          } catch (e) {
            this.handleUploadError(fileIndex, 'Upload failed');
          }
        }
      });

      xhr.addEventListener('error', () => {
        this.handleUploadError(fileIndex, 'Network error during upload');
      });

      xhr.addEventListener('abort', () => {
        this.handleUploadError(fileIndex, 'Upload cancelled');
      });

      // Start upload
      xhr.open('POST', this.config.apiUrl + '/upload');
      xhr.send(formData);
    },

    /**
     * Handle upload error
     */
    handleUploadError: function(fileIndex, errorMessage) {
      const statusElement = document.getElementById(`support-upload-status-${fileIndex}`);
      const progressElement = document.getElementById(`support-upload-progress-${fileIndex}`);
      const fileItem = document.getElementById(`support-file-item-${fileIndex}`);
      const removeBtn = fileItem.querySelector('.support-widget-file-remove');

      statusElement.textContent = 'Upload failed';
      statusElement.className = 'support-widget-upload-status support-widget-upload-error';
      progressElement.style.display = 'none';
      removeBtn.style.display = 'flex';

      // Remove from arrays
      this.selectedFiles.splice(fileIndex, 1);
      this.uploadedFileUrls.splice(fileIndex, 1);
      this.uploadedFilePaths.splice(fileIndex, 1);
      this.uploadedFileMetadata.splice(fileIndex, 1);

      // Show error message
      this.showError(`Failed to upload file: ${errorMessage}`);

      // Re-render file list
      this.renderFileList();
    },

    /**
     * Remove file from selection and delete from bucket
     */
    removeFile: function(index) {
      if (index >= 0 && index < this.selectedFiles.length) {
        const filePath = this.uploadedFilePaths[index];
        
        // If file was uploaded, delete it from bucket
        if (filePath) {
          this.deleteFileFromBucket(filePath, index);
        } else {
          // If file wasn't uploaded yet, just remove from arrays
          this.selectedFiles.splice(index, 1);
          this.uploadedFileUrls.splice(index, 1);
          this.uploadedFilePaths.splice(index, 1);
          this.renderFileList();
        }
      }
      const fileInput = document.getElementById('support-files');
      fileInput.value = '';
    },

    /**
     * Delete file from bucket
     */
    deleteFileFromBucket: function(filePath, fileIndex) {
      fetch(this.config.apiUrl + '/upload', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ file_path: filePath })
      })
      .then(async response => {
        const result = await this.safeParseResponse(response);
        if (!response.ok) {
          throw new Error(result.error?.message || result.message || 'Failed to delete file');
        }
        return result;
      })
      .then(result => {
        if (result.success) {
          // Remove from arrays
          this.selectedFiles.splice(fileIndex, 1);
          this.uploadedFileUrls.splice(fileIndex, 1);
          this.uploadedFilePaths.splice(fileIndex, 1);
          this.uploadedFileMetadata.splice(fileIndex, 1);
          this.renderFileList();
        } else {
          throw new Error(result.error?.message || 'Failed to delete file');
        }
      })
      .catch(error => {
        console.error('Support Widget Error:', error);
          // Still remove from UI even if deletion fails
        this.selectedFiles.splice(fileIndex, 1);
        this.uploadedFileUrls.splice(fileIndex, 1);
        this.uploadedFilePaths.splice(fileIndex, 1);
        this.uploadedFileMetadata.splice(fileIndex, 1);
        this.renderFileList();
        this.showError(`Failed to delete file: ${error.message || 'Please try again'}`);
      });
    },

    /**
     * Render file list
     */
    renderFileList: function() {
      const fileList = document.getElementById('support-widget-file-list');
      fileList.innerHTML = '';

      if (this.selectedFiles.length === 0) return;

      this.selectedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.id = `support-file-item-${index}`;
        fileItem.className = 'support-widget-file-item';
        
        const isUploaded = this.uploadedFileUrls[index] !== null && this.uploadedFileUrls[index] !== undefined;
        const statusText = isUploaded ? 'Uploaded ✓' : 'Uploading...';
        const statusClass = isUploaded ? 'support-widget-upload-success' : '';
        
        fileItem.innerHTML = `
          <div class="support-widget-file-info">
            <span class="support-widget-file-name">${file.name}</span>
            <span class="support-widget-file-size">${this.formatFileSize(file.size)}</span>
          </div>
          <div class="support-widget-file-status" style="${isUploaded ? 'display: none;' : ''}">
            <span class="support-widget-upload-status ${statusClass}" id="support-upload-status-${index}">${statusText}</span>
            <div class="support-widget-upload-progress" id="support-upload-progress-${index}">
              <div class="support-widget-progress-bar ${isUploaded ? 'support-widget-progress-complete' : ''}" style="${isUploaded ? 'width: 100%;' : ''}"></div>
            </div>
          </div>
          <button type="button" class="support-widget-file-remove" onclick="SupportWidget.removeFile(${index})" aria-label="Remove file">&times;</button>
        `;
        fileList.appendChild(fileItem);
      });
    },

    /**
     * Format file size
     */
    formatFileSize: function(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    },

    /**
     * Toggle modal visibility
     */
    toggleModal: function() {
      this.isOpen = !this.isOpen;
      const modal = document.getElementById('support-widget-modal');
      if (this.isOpen) {
        modal.classList.add('support-widget-open');
        document.body.style.overflow = 'hidden';
        this.showFormView();
      } else {
        this.closeModal();
      }
    },

    /**
     * Close modal
     */
    closeModal: function() {
      this.isOpen = false;
      const modal = document.getElementById('support-widget-modal');
      modal.classList.remove('support-widget-open');
      document.body.style.overflow = '';
      
      // Cleanup chat state
      this.closeChatPopup();
      
      // Reset form state
      this.selectedFiles = [];
      this.uploadedFileUrls = [];
      this.uploadedFilePaths = [];
      this.uploadedFileMetadata = [];
      this.ticketId = null;
      const form = document.getElementById('support-widget-form');
      if (form) {
        form.reset();
        this.clearFieldErrors();
      }
      const fileList = document.getElementById('support-widget-file-list');
      if (fileList) fileList.innerHTML = '';
      const messageDiv = document.getElementById('support-widget-message');
      if (messageDiv) {
        messageDiv.innerHTML = '';
        messageDiv.className = 'support-widget-message';
      }
      
      // Reset to form view
      this.showFormView();
    },

    /**
     * Show form view
     */
    showFormView: function() {
      this.currentView = 'form';
      document.getElementById('support-widget-form-view').style.display = 'block';
      document.getElementById('support-widget-tickets-view').style.display = 'none';
      document.getElementById('support-widget-chat-view').style.display = 'none';
      document.getElementById('support-widget-title').textContent = 'Contact Support';
      
      // Auto-fill user info if provided in config
      this.autoFillUserInfo();
    },

    /**
     * Auto-fill user information from config
     */
    autoFillUserInfo: function() {
      const nameField = document.getElementById('support-name');
      const emailField = document.getElementById('support-email');
      const ticketsEmailField = document.getElementById('support-tickets-email');

      if (this.config.userName && nameField) {
        nameField.value = this.config.userName;
        nameField.readOnly = true; // Prevent editing if auto-filled from config (use readOnly so value is included in FormData)
      }

      if (this.config.userEmail && emailField) {
        emailField.value = this.config.userEmail;
        emailField.readOnly = true; // Prevent editing if auto-filled from config (use readOnly so value is included in FormData)
      }

      if (this.config.userEmail && ticketsEmailField) {
        ticketsEmailField.value = this.config.userEmail;
        // Optionally auto-load tickets if email is provided
        // Uncomment the next line if you want tickets to load automatically
        // this.loadTickets();
      }
    },

    /**
     * Get user email from config or input field
     */
    getUserEmail: function() {
      // First try config (provided during init)
      if (this.config.userEmail) {
        return this.config.userEmail;
      }
      
      // Try tickets email input
      const ticketsEmailField = document.getElementById('support-tickets-email');
      if (ticketsEmailField && ticketsEmailField.value.trim()) {
        return ticketsEmailField.value.trim();
      }
      
      // Try form email input
      const formEmailField = document.getElementById('support-email');
      if (formEmailField && formEmailField.value.trim()) {
        return formEmailField.value.trim();
      }
      
      return null;
    },

    /**
     * Get user name from config or input field
     */
    getUserName: function() {
      // First try config (provided during init)
      if (this.config.userName) {
        return this.config.userName;
      }
      
      // Try form name input
      const nameField = document.getElementById('support-name');
      if (nameField && nameField.value.trim()) {
        return nameField.value.trim();
      }
      
      return null;
    },

    /**
     * Safely parse response (handles both JSON and plain text)
     */
    safeParseResponse: async function(response) {
      const contentType = response.headers.get('content-type') || '';
      
      try {
        if (contentType.includes('application/json')) {
          return await response.json();
        } else {
          const text = await response.text();
          // Try to parse as JSON even if content-type is wrong
          try {
            return JSON.parse(text);
          } catch {
            // Return as plain text error
            return {
              success: false,
              error: { message: text || `HTTP ${response.status}: ${response.statusText}` }
            };
          }
        }
      } catch (error) {
        return {
          success: false,
          error: { message: `Failed to parse response: ${error.message}` }
        };
      }
    },

    /**
     * Show tickets view
     */
    showTicketsView: function() {
      this.currentView = 'tickets';
      document.getElementById('support-widget-form-view').style.display = 'none';
      document.getElementById('support-widget-tickets-view').style.display = 'block';
      document.getElementById('support-widget-chat-view').style.display = 'none';
      document.getElementById('support-widget-title').textContent = 'My Support Tickets';
      
      // Auto-fill email if provided in config
      const ticketsEmailField = document.getElementById('support-tickets-email');
      if (this.config.userEmail && ticketsEmailField) {
        ticketsEmailField.value = this.config.userEmail;
        // Auto-load tickets if email is provided
        if (this.config.userEmail) {
          this.loadTickets();
        }
      }
    },

    /**
     * Load tickets by email
     */
    loadTickets: function() {
      // Try to get email from input field first, then fallback to config
      let email = document.getElementById('support-tickets-email').value.trim();
      if (!email) {
        email = this.config.userEmail || '';
      }
      
      if (!email || !this.isValidEmail(email)) {
        this.showError('Please enter a valid email address', 'support-widget-tickets-list');
        return;
      }

      const ticketsList = document.getElementById('support-widget-tickets-list');
      ticketsList.innerHTML = '<div class="support-widget-loading">Loading tickets...</div>';

      fetch(`${this.config.apiUrl}/tickets?email=${encodeURIComponent(email)}`)
        .then(async response => {
          if (!response.ok) {
            // Try to parse as JSON, fallback to text
            let errorData;
            const contentType = response.headers.get('content-type');
            try {
              if (contentType && contentType.includes('application/json')) {
                errorData = await response.json();
              } else {
                const text = await response.text();
                errorData = { error: { message: text || 'Failed to load tickets' } };
              }
            } catch (parseError) {
              errorData = { error: { message: `HTTP ${response.status}: ${response.statusText}` } };
            }
            throw new Error(errorData.error?.message || errorData.message || 'Failed to load tickets');
          }
          return response.json();
        })
        .then(result => {
          if (result.success) {
            this.currentTicketsEmail = email; // Store email for later use
            this.displayTickets(result.data.tickets || []);
          } else {
            throw new Error(result.error?.message || 'Failed to load tickets');
          }
        })
        .catch(error => {
          console.error('Support Widget Error:', error);
          ticketsList.innerHTML = `<div class="support-widget-error-message">${this.escapeHtml(error.message || 'Failed to load tickets. Please try again.')}</div>`;
        });
    },

    /**
     * Display tickets
     */
    displayTickets: function(tickets) {
      const ticketsList = document.getElementById('support-widget-tickets-list');
      
      if (tickets.length === 0) {
        ticketsList.innerHTML = '<div class="support-widget-empty">No tickets found for this email address.</div>';
        return;
      }

      ticketsList.innerHTML = tickets.map((ticket, index) => `
        <div class="support-widget-ticket-item" data-ticket-index="${index}">
          <div class="support-widget-ticket-header">
            <span class="support-widget-ticket-number">${ticket.ticket_number}</span>
            <span class="support-widget-ticket-status support-widget-status-${ticket.status}">${ticket.status}</span>
          </div>
          <div class="support-widget-ticket-subject">${this.escapeHtml(ticket.subject)}</div>
          <div class="support-widget-ticket-meta">
            <span>${ticket.category}</span>
            <span>${ticket.priority}</span>
            <span>${new Date(ticket.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      `).join('');
      
      // Store tickets and add click handlers
      this.loadedTickets = tickets;
      ticketsList.querySelectorAll('.support-widget-ticket-item').forEach((item, index) => {
        item.addEventListener('click', () => {
          this.openChatPopup(tickets[index]);
        });
      });
    },

    /**
     * Open chat popup for a ticket
     */
    openChatPopup: function(ticket) {
      this.currentTicket = ticket;
      this.currentTicketId = ticket.id;
      this.currentView = 'chat';
      this.ticketMessages = [];

      // Hide other views and show chat view
      document.getElementById('support-widget-form-view').style.display = 'none';
      document.getElementById('support-widget-tickets-view').style.display = 'none';
      document.getElementById('support-widget-chat-view').style.display = 'block';
      document.getElementById('support-widget-title').textContent = `Ticket: ${ticket.ticket_number}`;

      // Render ticket details in chat header
      this.renderChatHeader();

      // Fetch messages
      const email = ticket.user_email || this.currentTicketsEmail || this.getUserEmail();
      this.fetchTicketMessages(ticket.id, email);

      // Setup realtime or polling
      if (this.supabaseClient) {
        this.setupRealtimeSubscription(ticket.id);
      } else {
        this.setupMessagePolling(ticket.id);
      }

      // Focus on input
      setTimeout(() => {
        const input = document.getElementById('support-widget-chat-input');
        if (input) input.focus();
      }, 100);
    },

    /**
     * Close chat popup and cleanup
     */
    closeChatPopup: function() {
      // Cleanup realtime subscription
      if (this.realtimeSubscription && this.supabaseClient) {
        this.supabaseClient.removeChannel(this.realtimeSubscription).catch(() => {});
        this.realtimeSubscription = null;
      }

      // Cleanup polling
      if (this.messagePollInterval) {
        clearInterval(this.messagePollInterval);
        this.messagePollInterval = null;
      }

      // Reset state
      this.currentTicketId = null;
      this.currentTicket = null;
      this.ticketMessages = [];
      this.chatSelectedFiles = [];
      this.chatUploadedAttachments = [];

      // Hide chat view and show tickets view
      document.getElementById('support-widget-chat-view').style.display = 'none';
      document.getElementById('support-widget-tickets-view').style.display = 'block';
      this.currentView = 'tickets';
      document.getElementById('support-widget-title').textContent = 'My Support Tickets';
    },

    /**
     * Handle chat file selection
     */
    handleChatFileSelection: function(files) {
      if (!files || files.length === 0) return;

      // Limit to 5 files total
      const maxFiles = 5;
      const currentCount = this.chatSelectedFiles.length;
      const remainingSlots = maxFiles - currentCount;

      if (remainingSlots <= 0) {
        this.showChatError('Maximum 5 files allowed');
        return;
      }

      // Add files (respecting the limit)
      const filesToAdd = Array.from(files).slice(0, remainingSlots);
      
      filesToAdd.forEach(file => {
        // Validate file size (10MB max)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
          this.showChatError(`File "${file.name}" exceeds 10MB limit`);
          return;
        }

        // Validate file type
        const allowedTypes = ['image/', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument', 'text/', 'application/vnd.ms-excel'];
        const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv', '.svg'];
        const isValidType = allowedTypes.some(type => file.type.startsWith(type)) || 
                          allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
        
        if (!isValidType) {
          this.showChatError(`File type not allowed: "${file.name}". Allowed: images, SVG, PDF, Word, Excel,png ,Webp , jpg,jpeg, text files. and other file types.`);
          return;
        }

        this.chatSelectedFiles.push(file);
      });

      this.renderChatFileList();
      
      // Reset file input
      const fileInput = document.getElementById('support-widget-chat-files');
      if (fileInput) fileInput.value = '';
    },

    /**
     * Render chat file list
     */
    renderChatFileList: function() {
      const fileListContainer = document.getElementById('support-widget-chat-file-list');
      if (!fileListContainer) return;

      if (this.chatSelectedFiles.length === 0 && this.chatUploadedAttachments.length === 0) {
        fileListContainer.style.display = 'none';
        return;
      }

      fileListContainer.style.display = 'block';
      fileListContainer.innerHTML = '';

      // Show selected files (not yet uploaded)
      this.chatSelectedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'support-widget-chat-file-item';
        fileItem.innerHTML = `
          <span class="support-widget-chat-file-name">${this.escapeHtml(file.name)}</span>
          <span class="support-widget-chat-file-size">${this.formatFileSize(file.size)}</span>
          <button type="button" class="support-widget-chat-file-remove" onclick="SupportWidget.removeChatFile(${index})" title="Remove">&times;</button>
        `;
        fileListContainer.appendChild(fileItem);
      });

      // Show uploaded attachments
      this.chatUploadedAttachments.forEach((attachment, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'support-widget-chat-file-item support-widget-chat-file-uploaded';
        fileItem.innerHTML = `
          <span class="support-widget-chat-file-name">${this.escapeHtml(attachment.file_name)}</span>
          <span class="support-widget-chat-file-size">${this.formatFileSize(attachment.file_size || 0)}</span>
          <span class="support-widget-chat-file-status">✓</span>
        `;
        fileListContainer.appendChild(fileItem);
      });
    },

    /**
     * Remove chat file
     */
    removeChatFile: function(index) {
      if (index >= 0 && index < this.chatSelectedFiles.length) {
        this.chatSelectedFiles.splice(index, 1);
        this.renderChatFileList();
      }
    },

    /**
     * Show chat error
     */
    showChatError: function(message) {
      const errorDiv = document.getElementById('support-widget-chat-error');
      if (errorDiv) {
        errorDiv.className = 'support-widget-message support-widget-error';
        errorDiv.innerHTML = `<strong>✗ Error:</strong> ${this.escapeHtml(message)}`;
        setTimeout(() => {
          errorDiv.innerHTML = '';
          errorDiv.className = 'support-widget-message';
        }, 5000);
      }
    },

    /**
     * Upload chat file
     */
    uploadChatFile: function(file, ticketId) {
      return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);
        if (ticketId) formData.append('ticket_id', ticketId);

        const xhr = new XMLHttpRequest();

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            try {
              const response = JSON.parse(xhr.responseText);
              if (response.success && response.data) {
                resolve({
                  file_url: response.data.file_url_public || response.data.file_url,
                  file_path: response.data.file_path,
                  file_name: response.data.file_name || file.name,
                  file_size: response.data.file_size || file.size,
                  file_type: response.data.file_type || file.type
                });
              } else {
                // Extract error message from response
                const errorMsg = response.error?.message || response.message || 'File upload failed. Please try again.';
                reject(new Error(errorMsg));
              }
            } catch (error) {
              reject(new Error('Failed to process upload response. Please try again.'));
            }
          } else {
            // Handle error response
            let errorMessage = 'File upload failed. Please try again.';
            try {
              const errorResponse = JSON.parse(xhr.responseText);
              errorMessage = errorResponse.error?.message || errorResponse.message || errorMessage;
              
              // Handle specific error codes
              if (errorResponse.error?.code === 'FILE_TOO_LARGE') {
                errorMessage = 'File is too large. Maximum size is 10MB. Please choose a smaller file.';
              } else if (errorResponse.error?.code === 'INVALID_FILE_TYPE') {
                errorMessage = errorResponse.error.message || 'This file type is not allowed. Allowed: images (including SVG), PDF, Word, Excel, text files.';
              } else if (errorResponse.error?.code === 'TOO_MANY_FILES') {
                errorMessage = 'Maximum 5 files allowed per upload.';
              }
            } catch (e) {
              // If parsing fails, use status-based messages
              if (xhr.status === 400) {
                errorMessage = 'Invalid file. Please check the file type and size.';
              } else if (xhr.status === 413) {
                errorMessage = 'File is too large. Maximum size is 10MB.';
              } else if (xhr.status >= 500) {
                errorMessage = 'Server error. Please try again later.';
              }
            }
            reject(new Error(errorMessage));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'));
        });

        xhr.open('POST', this.config.apiUrl + '/upload');
        xhr.send(formData);
      });
    },

    /**
     * Render chat header with ticket info
     */
    renderChatHeader: function() {
      if (!this.currentTicket) return;

      document.getElementById('support-widget-chat-ticket-number').textContent = `Ticket: ${this.currentTicket.ticket_number}`;
      document.getElementById('support-widget-chat-status').textContent = this.currentTicket.status;
      document.getElementById('support-widget-chat-status').className = `support-widget-ticket-status support-widget-status-${this.currentTicket.status}`;
      document.getElementById('support-widget-chat-subject').textContent = this.currentTicket.subject || '';
    },

    /**
     * Fetch ticket messages
     */
    fetchTicketMessages: function(ticketId, email) {
      const messagesContainer = document.getElementById('support-widget-chat-messages');
      messagesContainer.innerHTML = '<div class="support-widget-loading">Loading messages...</div>';

      fetch(`${this.config.apiUrl}/tickets?email=${encodeURIComponent(email)}&ticket_number=${this.currentTicket.ticket_number}`)
        .then(async response => {
          const result = await this.safeParseResponse(response);
          if (!response.ok) {
            throw new Error(result.error?.message || result.message || 'Failed to load messages');
          }
          return result;
        })
        .then(result => {
          if (result.success && result.data.ticket && result.data.ticket.messages) {
            this.ticketMessages = result.data.ticket.messages || [];
            this.renderMessages();
          } else {
            messagesContainer.innerHTML = '<div class="support-widget-empty">No messages found.</div>';
          }
        })
        .catch(error => {
          console.error('Support Widget Error:', error);
          messagesContainer.innerHTML = `<div class="support-widget-error-message">${error.message || 'Failed to load messages. Please try again.'}</div>`;
        });
    },

    /**
     * Render messages in chat
     */
    renderMessages: function() {
      const messagesContainer = document.getElementById('support-widget-chat-messages');
      
      if (this.ticketMessages.length === 0) {
        messagesContainer.innerHTML = '<div class="support-widget-empty">No messages yet. Start the conversation!</div>';
        return;
      }

      const email = this.getUserEmail();
      
      messagesContainer.innerHTML = this.ticketMessages.map(msg => {
        const isUser = msg.message_type === 'user' || msg.sender_email === email;
        const senderName = msg.sender_name || (isUser ? 'You' : 'Support Team');
        const messageDate = new Date(msg.created_at);
        const attachments = msg.attachments || [];
        
        const attachmentsHtml = attachments.length > 0 ? `
          <div class="support-widget-chat-attachments">
            ${attachments.map(att => {
              const isImage = att.file_type && att.file_type.startsWith('image/');
              const fileName = this.escapeHtml(att.file_name);
              const fileSize = this.formatFileSize(att.file_size || 0);
              
              if (isImage) {
                return `
                  <div class="support-widget-chat-attachment support-widget-chat-attachment-image">
                    <a href="${this.escapeHtml(att.file_url)}" target="_blank" rel="noopener noreferrer">
                      <img src="${this.escapeHtml(att.file_url)}" alt="${fileName}" loading="lazy">
                      <span class="support-widget-chat-attachment-name">${fileName}</span>
                      <span class="support-widget-chat-attachment-size">${fileSize}</span>
                    </a>
                  </div>
                `;
              } else {
                return `
                  <div class="support-widget-chat-attachment">
                    <a href="${this.escapeHtml(att.file_url)}" target="_blank" rel="noopener noreferrer" class="support-widget-chat-attachment-link">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                      </svg>
                      <span class="support-widget-chat-attachment-name">${fileName}</span>
                      <span class="support-widget-chat-attachment-size">${fileSize}</span>
                    </a>
                  </div>
                `;
              }
            }).join('')}
          </div>
        ` : '';
        
        return `
          <div class="support-widget-chat-message ${isUser ? 'support-widget-message-user' : 'support-widget-message-admin'}">
            <div class="support-widget-chat-message-header">
              <span class="support-widget-chat-message-sender">${this.escapeHtml(senderName)}</span>
              <span class="support-widget-chat-message-time">${messageDate.toLocaleString()}</span>
            </div>
            ${msg.message && msg.message !== '(File attachment)' ? `<div class="support-widget-chat-message-text">${this.escapeHtml(msg.message).replace(/\n/g, '<br>')}</div>` : ''}
            ${attachmentsHtml}
          </div>
        `;
      }).join('');

      // Scroll to bottom
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    },

    /**
     * Send chat message
     */
    sendChatMessage: function() {
      const input = document.getElementById('support-widget-chat-input');
      const message = input.value.trim();
      const errorDiv = document.getElementById('support-widget-chat-error');
      const hasAttachments = this.chatSelectedFiles.length > 0 || this.chatUploadedAttachments.length > 0;
      
      // Require either message or attachments
      if (!message && !hasAttachments) {
        errorDiv.className = 'support-widget-message support-widget-error';
        errorDiv.innerHTML = '<strong>✗ Error:</strong> Please enter a message or attach a file';
        return;
      }

      if (message && message.length < 3) {
        errorDiv.className = 'support-widget-message support-widget-error';
        errorDiv.innerHTML = '<strong>✗ Error:</strong> Message must be at least 3 characters';
        return;
      }

      if (!this.currentTicketId) {
        errorDiv.className = 'support-widget-message support-widget-error';
        errorDiv.innerHTML = '<strong>✗ Error:</strong> No ticket selected';
        return;
      }

      const email = this.getUserEmail();
      if (!email) {
        errorDiv.className = 'support-widget-message support-widget-error';
        errorDiv.innerHTML = '<strong>✗ Error:</strong> Email is required';
        return;
      }

      // Disable input and show loading
      const sendBtn = document.getElementById('support-widget-chat-send');
      sendBtn.disabled = true;
      sendBtn.textContent = hasAttachments ? 'Uploading & Sending...' : 'Sending...';
      errorDiv.innerHTML = '';
      errorDiv.className = 'support-widget-message';

      // Upload files first if any are selected
      const uploadPromises = this.chatSelectedFiles.map(file => 
        this.uploadChatFile(file, this.currentTicketId)
      );

      Promise.all(uploadPromises)
        .then(uploadedFiles => {
          // Add uploaded files to attachments array
          this.chatUploadedAttachments.push(...uploadedFiles);
          
          // Prepare message data
          const messageData = {
            email: email,
            message: message || '(File attachment)',
            attachments: this.chatUploadedAttachments.map(att => ({
              file_url: att.file_url,
              file_path: att.file_path,
              file_name: att.file_name,
              file_size: att.file_size,
              file_type: att.file_type
            }))
          };

          // Send message with attachments
          return fetch(`${this.config.apiUrl}/tickets/${this.currentTicketId}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(messageData)
          });
        })
        .then(async response => {
          const result = await this.safeParseResponse(response);
          if (!response.ok) {
            throw new Error(result.error?.message || result.message || 'Failed to send message');
          }
          return result;
        })
        .then(result => {
          if (result.success && result.data.message) {
            // Add message to local array
            this.ticketMessages.push(result.data.message);
            this.renderMessages();
            input.value = '';
            this.updateCharCount('chat-input');
            
            // Clear attachments
            this.chatSelectedFiles = [];
            this.chatUploadedAttachments = [];
            this.renderChatFileList();
          } else {
            throw new Error(result.error?.message || 'Failed to send message');
          }
        })
        .catch(error => {
          console.error('Support Widget Error:', error);
          errorDiv.className = 'support-widget-message support-widget-error';
          
          // Provide user-friendly error message
          let errorMessage = error.message || 'Failed to send message. Please try again.';
          
          // Clean up error message
          if (errorMessage.includes('file type') || errorMessage.includes('file size') || errorMessage.includes('FILE_TOO_LARGE') || errorMessage.includes('INVALID_FILE_TYPE')) {
            errorMessage = errorMessage.replace(/^Error: /, '').replace(/^✗ Error: /, '');
          }
          
          errorDiv.innerHTML = `<strong>✗ Error:</strong> ${this.escapeHtml(errorMessage)}`;
          
          // If upload failed, remove failed files from UI
          if (error.message && (error.message.includes('upload') || error.message.includes('file'))) {
            this.chatSelectedFiles = [];
            this.renderChatFileList();
          }
        })
        .finally(() => {
          sendBtn.disabled = false;
          sendBtn.textContent = 'Send';
          input.focus();
        });
    },

    /**
     * Setup Supabase realtime subscription
     */
    setupRealtimeSubscription: function(ticketId) {
      if (!this.supabaseClient) return;

      try {
        // Remove existing subscription if any
        if (this.realtimeSubscription) {
          this.supabaseClient.removeChannel(this.realtimeSubscription).catch(() => {});
        }

        const channel = this.supabaseClient
          .channel(`ticket-${ticketId}-${Date.now()}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'support_messages',
              filter: `ticket_id=eq.${ticketId}`
            },
            (payload) => {
              // Check if message already exists
              const exists = this.ticketMessages.some(msg => msg.id === payload.new.id);
              if (!exists) {
                this.ticketMessages.push(payload.new);
                this.renderMessages();
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('✅ Realtime subscription active');
            } else if (status === 'CHANNEL_ERROR') {
              console.warn('⚠️ Realtime subscription error, falling back to polling');
              this.setupMessagePolling(ticketId);
            }
          });

        this.realtimeSubscription = channel;
      } catch (error) {
        console.warn('⚠️ Failed to setup realtime subscription:', error);
        this.setupMessagePolling(ticketId);
      }
    },

    /**
     * Setup message polling as fallback
     */
    setupMessagePolling: function(ticketId) {
      // Clear existing polling
      if (this.messagePollInterval) {
        clearInterval(this.messagePollInterval);
      }

      const email = this.getUserEmail();
      if (!email) return;

      let lastMessageCount = this.ticketMessages.length;

      this.messagePollInterval = setInterval(() => {
        fetch(`${this.config.apiUrl}/tickets?email=${encodeURIComponent(email)}&ticket_number=${this.currentTicket.ticket_number}`)
          .then(async response => {
            if (!response.ok) return null;
            return await this.safeParseResponse(response);
          })
          .then(result => {
            if (result.success && result.data.ticket && result.data.ticket.messages) {
              const messages = result.data.ticket.messages || [];
              
              // Check if new messages arrived
              if (messages.length > lastMessageCount) {
                this.ticketMessages = messages;
                this.renderMessages();
                lastMessageCount = messages.length;
              }
            }
          })
          .catch(error => {
            // Silently fail polling errors
            console.warn('Polling error:', error);
          });
      }, 3000); // Poll every 3 seconds
    },

    /**
     * Validate email
     */
    isValidEmail: function(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    /**
     * Validate form fields
     */
    validateForm: function() {
      const form = document.getElementById('support-widget-form');
      const formData = new FormData(form);
      const errors = {};

      // Get field values - use DOM element value if FormData doesn't include it (for disabled/readonly fields)
      const nameField = document.getElementById('support-name');
      const emailField = document.getElementById('support-email');
      const subjectField = document.getElementById('support-subject');
      const messageField = document.getElementById('support-message');
      
      const name = (formData.get('name') || nameField?.value || '').trim();
      const email = (formData.get('email') || emailField?.value || '').trim();
      const subject = (formData.get('subject') || subjectField?.value || '').trim();
      const message = (formData.get('message') || messageField?.value || '').trim();

      // Clear previous errors
      this.clearFieldErrors();

      // Validate name (required)
      if (!name) {
        errors.name = 'Name is required';
      } else if (name.length < 2) {
        errors.name = 'Name must be at least 2 characters';
      } else if (name.length > 255) {
        errors.name = 'Name must not exceed 255 characters';
      }

      // Validate email (required, format, length)
      if (!email) {
        errors.email = 'Email is required';
      } else if (!this.isValidEmail(email)) {
        errors.email = 'Please enter a valid email address';
      } else if (email.length > 255) {
        errors.email = 'Email must not exceed 255 characters';
      }

      // Validate subject/title (required, length)
      if (!subject) {
        errors.subject = 'Subject is required';
      } else if (subject.length < 3) {
        errors.subject = 'Subject must be at least 3 characters';
      } else if (subject.length > 255) {
        errors.subject = 'Subject must not exceed 255 characters';
      }

      // Validate message/description (required, length)
      if (!message) {
        errors.message = 'Message is required';
      } else if (message.length < 10) {
        errors.message = 'Message must be at least 10 characters';
      } else if (message.length > 5000) {
        errors.message = 'Message must not exceed 5000 characters';
      }

      // Display errors
      if (Object.keys(errors).length > 0) {
        this.displayFieldErrors(errors);
        return false;
      }

      return true;
    },

    /**
     * Display field errors
     */
    displayFieldErrors: function(errors) {
      Object.keys(errors).forEach(fieldName => {
        const field = document.getElementById(`support-${fieldName}`);
        if (field) {
          field.classList.add('support-widget-field-error');
          
          // Create or update error message
          let errorDiv = field.parentElement.querySelector('.support-widget-field-error-message');
          if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.className = 'support-widget-field-error-message';
            field.parentElement.appendChild(errorDiv);
          }
          errorDiv.textContent = errors[fieldName];
        }
      });
    },

    /**
     * Clear all field errors
     */
    clearFieldErrors: function() {
      const fields = document.querySelectorAll('#support-widget-form input, #support-widget-form textarea');
      fields.forEach(field => {
        field.classList.remove('support-widget-field-error');
        const errorDiv = field.parentElement.querySelector('.support-widget-field-error-message');
        if (errorDiv) {
          errorDiv.remove();
        }
      });
    },

    /**
     * Validate individual field
     */
    validateField: function(fieldName) {
      const form = document.getElementById('support-widget-form');
      const formData = new FormData(form);
      const field = document.getElementById(`support-${fieldName}`);
      
      if (!field) return true;

      // Use DOM element value if FormData doesn't include it (for disabled/readonly fields)
      let value = (formData.get(fieldName) || field.value || '').trim();
      let error = null;

      switch(fieldName) {
        case 'name':
          if (!value) {
            error = 'Name is required';
          } else if (value.length < 2) {
            error = 'Name must be at least 2 characters';
          } else if (value.length > 255) {
            error = 'Name must not exceed 255 characters';
          }
          break;
        case 'email':
          if (!value) {
            error = 'Email is required';
          } else if (!this.isValidEmail(value)) {
            error = 'Please enter a valid email address';
          } else if (value.length > 255) {
            error = 'Email must not exceed 255 characters';
          }
          break;
        case 'subject':
          if (!value) {
            error = 'Subject is required';
          } else if (value.length < 3) {
            error = 'Subject must be at least 3 characters';
          } else if (value.length > 255) {
            error = 'Subject must not exceed 255 characters';
          }
          break;
        case 'message':
          if (!value) {
            error = 'Message is required';
          } else if (value.length < 10) {
            error = 'Message must be at least 10 characters';
          } else if (value.length > 5000) {
            error = 'Message must not exceed 5000 characters';
          }
          break;
      }

      // Clear previous error
      field.classList.remove('support-widget-field-error');
      const existingError = field.parentElement.querySelector('.support-widget-field-error-message');
      if (existingError) {
        existingError.remove();
      }

      // Display error if any
      if (error) {
        field.classList.add('support-widget-field-error');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'support-widget-field-error-message';
        errorDiv.textContent = error;
        field.parentElement.appendChild(errorDiv);
        return false;
      }

      return true;
    },

    /**
     * Update character count for field
     */
    updateCharCount: function(fieldName) {
      let field, countElement, maxLength;
      
      if (fieldName === 'chat-input') {
        field = document.getElementById('support-widget-chat-input');
        countElement = document.getElementById('support-widget-chat-char-count');
        maxLength = 5000;
      } else {
        field = document.getElementById(`support-${fieldName}`);
        countElement = document.getElementById(`support-${fieldName}-count`);
        maxLength = fieldName === 'subject' ? 255 : 5000;
      }
      
      if (field && countElement) {
        const length = field.value.length;
        countElement.textContent = `${length}/${maxLength}`;
        
        // Change color if approaching limit
        const charCountDiv = countElement;
        if (length > maxLength * 0.9) {
          charCountDiv.style.color = '#dc3545';
        } else if (length > maxLength * 0.75) {
          charCountDiv.style.color = '#ffc107';
        } else {
          charCountDiv.style.color = '#6c757d';
        }
      }
    },

    /**
     * Escape HTML
     */
    escapeHtml: function(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },

    /**
     * Show error message
     */
    showError: function(message, containerId = 'support-widget-message') {
      const messageDiv = document.getElementById(containerId);
      messageDiv.className = 'support-widget-message support-widget-error';
      messageDiv.innerHTML = `<strong>✗ Error:</strong> ${this.escapeHtml(message)}`;
    },

    /**
     * Submit ticket
     */
    submitTicket: function() {
      // Prevent multiple simultaneous submissions
      if (this.isSubmitting) {
        return;
      }

      // Validate form before submission
      if (!this.validateForm()) {
        const messageDiv = document.getElementById('support-widget-message');
        messageDiv.className = 'support-widget-message support-widget-error';
        messageDiv.innerHTML = '<strong>✗ Please fix the errors above</strong>';
        return;
      }

      // Set submitting flag to prevent multiple submissions
      this.isSubmitting = true;

      const form = document.getElementById('support-widget-form');
      const submitBtn = document.getElementById('support-widget-submit');
      const messageDiv = document.getElementById('support-widget-message');

      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
      messageDiv.innerHTML = '';
      messageDiv.className = 'support-widget-message';

      const formData = new FormData(form);
      // Get field elements to read values directly if FormData doesn't include them (for readonly fields)
      const nameField = document.getElementById('support-name');
      const emailField = document.getElementById('support-email');
      const subjectField = document.getElementById('support-subject');
      const messageField = document.getElementById('support-message');
      
      const data = {
        name: formData.get('name') || nameField?.value || '',
        email: formData.get('email') || emailField?.value || '',
        subject: formData.get('subject') || subjectField?.value || '',
        message: formData.get('message') || messageField?.value || '',
        category: formData.get('category') || 'general',
        priority: formData.get('priority') || 'medium',
        api_key: this.config.apiKey,
        source_url: window.location.href,
        user_agent: navigator.userAgent,
        metadata: {
          referrer: document.referrer,
          timestamp: new Date().toISOString()
        }
      };

      // Check if all files are uploaded
      const pendingUploads = this.uploadedFileUrls.filter((url, index) => 
        this.selectedFiles[index] && url === null
      ).length;

      if (pendingUploads > 0) {
        messageDiv.className = 'support-widget-message support-widget-error';
        messageDiv.innerHTML = '<strong>✗ Please wait for all files to finish uploading</strong>';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Ticket';
        return;
      }

      // Prepare data with file information (URLs, paths, and metadata)
      const fileInfos = [];
      this.uploadedFileUrls.forEach((url, index) => {
        if (url !== null && this.uploadedFileMetadata[index]) {
          fileInfos.push({
            file_url: url,
            file_path: this.uploadedFilePaths[index],
            file_name: this.uploadedFileMetadata[index].name,
            file_size: this.uploadedFileMetadata[index].size,
            file_type: this.uploadedFileMetadata[index].type
          });
        }
      });
      
      if (fileInfos.length > 0) {
        data.file_attachments = fileInfos; // Send complete file information
      }
      
      // Include ticket_id if available (from file uploads)
      // This ensures the ticket uses the same UUID as the files
      if (this.ticketId) {
        data.ticket_id = this.ticketId;
      }

      // Send as JSON instead of FormData since files are already uploaded
      fetch(this.config.apiUrl + '/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })
      .then(async response => {
        const result = await this.safeParseResponse(response);
        if (!response.ok) {
          throw new Error(result.error?.message || result.message || 'Failed to submit ticket');
        }
        return result;
      })
      .then(result => {
        if (result.success) {
          messageDiv.className = 'support-widget-message support-widget-success';
          messageDiv.innerHTML = `
            <strong>✓ Success!</strong><br>
            ${result.data.message}<br>
            <small>Ticket #: ${result.data.ticket.ticket_number}</small>
            ${result.data.attachments_uploaded > 0 ? `<br><small>${result.data.attachments_uploaded} file(s) uploaded</small>` : ''}
          `;
          form.reset();
          this.selectedFiles = [];
          this.uploadedFileUrls = [];
          this.uploadedFilePaths = [];
          this.uploadedFileMetadata = [];
          this.ticketId = null;
          document.getElementById('support-widget-file-list').innerHTML = '';
          this.clearFieldErrors();
          this.updateCharCount('subject');
          this.updateCharCount('message');
          
          setTimeout(() => {
            this.closeModal();
            messageDiv.innerHTML = '';
          }, 4000);
        } else {
          throw new Error(result.error?.message || 'Failed to submit ticket');
        }
      })
      .catch(error => {
        console.error('Support Widget Error:', error);
        messageDiv.className = 'support-widget-message support-widget-error';
        messageDiv.innerHTML = `<strong>✗ Error:</strong> ${this.escapeHtml(error.message || 'Failed to submit ticket. Please try again.')}`;
      })
      .finally(() => {
        this.isSubmitting = false;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Ticket';
      });
    },

    /**
     * Inject CSS styles with production-quality fonts
     */
    injectStyles: function() {
      // Check if styles already injected
      if (document.getElementById('support-widget-styles')) {
        return;
      }

      const style = document.createElement('style');
      style.id = 'support-widget-styles';
      style.textContent = `
        /* System Font Stack - Scoped to Widget Elements Only */
        .support-widget-btn,
        .support-widget-modal,
        .support-widget-modal * {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji" !important;
          -webkit-font-smoothing: antialiased !important;
          -moz-osx-font-smoothing: grayscale !important;
          text-rendering: optimizeLegibility !important;
        }

        /* Widget Button - Enhanced Professional Design */
        .support-widget-btn {
          position: fixed;
          z-index: ${this.config.zIndex};
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 16px 26px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 50px;
          cursor: pointer;
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.35), 0 2px 8px rgba(0, 0, 0, 0.15);
          font-size: 15px;
          font-weight: 600;
          letter-spacing: 0.3px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          font-family: inherit;
        }
        .support-widget-btn:hover {
          transform: translateY(-3px) scale(1.02);
          box-shadow: 0 10px 30px rgba(102, 126, 234, 0.5), 0 4px 12px rgba(0, 0, 0, 0.2);
        }
        .support-widget-btn:active {
          transform: translateY(-1px) scale(0.98);
          transition: all 0.1s;
        }
        .support-widget-btn svg {
          width: 20px;
          height: 20px;
          flex-shrink: 0;
        }
        .support-widget-btn-bottom-right { bottom: 24px; right: 24px; }
        .support-widget-btn-bottom-left { bottom: 24px; left: 24px; }
        .support-widget-btn-top-right { top: 24px; right: 24px; }
        .support-widget-btn-top-left { top: 24px; left: 24px; }

        /* Modal */
        .support-widget-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: ${this.config.zIndex + 1};
          display: none;
          align-items: center;
          justify-content: center;
          padding: 20px;
          box-sizing: border-box;
        }
        .support-widget-modal.support-widget-open {
          display: flex;
        }
        .support-widget-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(8px) saturate(180%);
          -webkit-backdrop-filter: blur(8px) saturate(180%);
          animation: fadeIn 0.2s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .support-widget-content {
          position: relative;
          background: white;
          border-radius: 24px;
          width: 100%;
          max-width: 600px;
          max-height: 90vh;
          overflow: hidden;
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
          z-index: 1;
          display: flex;
          flex-direction: column;
          animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .support-widget-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 26px 32px;
          border-bottom: 1px solid rgba(233, 236, 239, 0.8);
          flex-shrink: 0;
          background: linear-gradient(to bottom, rgba(255, 255, 255, 1), rgba(248, 249, 250, 0.5));
        }
        .support-widget-header h2 {
          margin: 0;
          font-size: 27px;
          font-weight: 700;
          color: #1a1a1a;
          letter-spacing: -0.6px;
          font-family: inherit;
          line-height: 1.2;
        }
        .support-widget-close {
          background: none;
          border: none;
          font-size: 28px;
          color: #6c757d;
          cursor: pointer;
          padding: 0;
          width: 38px;
          height: 38px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          font-family: inherit;
        }
        .support-widget-close:hover {
          color: #1a1a1a;
          background: rgba(248, 249, 250, 0.9);
          transform: rotate(90deg);
        }
        .support-widget-body {
          overflow-y: auto;
          flex: 1;
          scrollbar-width: thin;
          scrollbar-color: rgba(108, 117, 125, 0.3) transparent;
        }
        .support-widget-body::-webkit-scrollbar {
          width: 8px;
        }
        .support-widget-body::-webkit-scrollbar-track {
          background: transparent;
        }
        .support-widget-body::-webkit-scrollbar-thumb {
          background: rgba(108, 117, 125, 0.3);
          border-radius: 4px;
        }
        .support-widget-body::-webkit-scrollbar-thumb:hover {
          background: rgba(108, 117, 125, 0.5);
        }
        .support-widget-view {
          padding: 32px;
        }
        .support-widget-form {
          display: flex;
          flex-direction: column;
          gap: 22px;
        }
        .support-widget-field {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .support-widget-field label {
          font-weight: 600;
          color: #495057;
          font-size: 14px;
          letter-spacing: 0.1px;
          font-family: inherit;
          margin-bottom: 2px;
        }
        .support-widget-field input,
        .support-widget-field select,
        .support-widget-field textarea {
          width: 100%;
          padding: 15px 18px;
          border: 1.5px solid #e9ecef;
          border-radius: 12px;
          font-size: 15px;
          font-family: inherit;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          box-sizing: border-box;
          background: white;
          color: #1a1a1a;
        }
        .support-widget-field select {
          cursor: pointer;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23495057' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 16px center;
          padding-right: 42px;
        }
        .support-widget-field input:focus,
        .support-widget-field select:focus,
        .support-widget-field textarea:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.12), 0 2px 8px rgba(102, 126, 234, 0.08);
          transform: translateY(-1px);
        }
        .support-widget-field input[readonly],
        .support-widget-field textarea[readonly] {
          background-color: #f8f9fa;
          cursor: not-allowed;
          opacity: 0.9;
        }
        .support-widget-field input.support-widget-field-error,
        .support-widget-field textarea.support-widget-field-error {
          border-color: #dc3545;
          box-shadow: 0 0 0 3px rgba(220, 53, 69, 0.1);
        }
        .support-widget-field-error-message {
          color: #dc3545;
          font-size: 13px;
          margin-top: 4px;
          font-weight: 500;
          font-family: inherit;
        }
        .support-widget-char-count {
          font-size: 12px;
          color: #6c757d;
          margin-top: 4px;
          text-align: right;
          font-family: inherit;
        }
        .support-widget-field textarea {
          resize: vertical;
          min-height: 120px;
          font-family: inherit;
        }
        .support-widget-file-upload {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .support-widget-file-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 22px;
          background: linear-gradient(to bottom, #ffffff, #f8f9fa);
          border: 2px dashed #dee2e6;
          border-radius: 12px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          color: #495057;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          font-family: inherit;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
        }
        .support-widget-file-btn:hover {
          background: linear-gradient(to bottom, #f8f9fa, #ffffff);
          border-color: #667eea;
          border-style: solid;
          color: #667eea;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
          transform: translateY(-2px);
        }
        .support-widget-file-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .support-widget-file-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: linear-gradient(to bottom, #ffffff, #f8f9fa);
          border-radius: 10px;
          font-size: 14px;
          font-family: inherit;
          position: relative;
          border: 1px solid rgba(233, 236, 239, 0.6);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
        }
        .support-widget-file-info {
          display: flex;
          flex-direction: column;
          flex: 1;
          gap: 4px;
        }
        .support-widget-file-name {
          color: #495057;
          font-weight: 500;
        }
        .support-widget-file-size {
          color: #6c757d;
          font-size: 13px;
        }
        .support-widget-file-status {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 120px;
        }
        .support-widget-upload-status {
          font-size: 12px;
          color: #6c757d;
          font-weight: 500;
        }
        .support-widget-upload-success {
          color: #28a745;
        }
        .support-widget-upload-error {
          color: #dc3545;
        }
        .support-widget-upload-progress {
          width: 100%;
          height: 4px;
          background: #e9ecef;
          border-radius: 2px;
          overflow: hidden;
        }
        .support-widget-progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
          width: 0%;
          transition: width 0.3s ease;
        }
        .support-widget-progress-complete {
          background: #28a745;
        }
        .support-widget-file-remove {
          background: none;
          border: none;
          color: #dc3545;
          cursor: pointer;
          font-size: 20px;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: all 0.2s;
        }
        .support-widget-file-remove:hover {
          background: #fee;
        }
        .support-widget-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 8px;
          flex-wrap: wrap;
        }
        .support-widget-actions button {
          padding: 15px 32px;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          font-family: inherit;
          letter-spacing: 0.2px;
          position: relative;
          overflow: hidden;
        }
        .support-widget-actions button[type="button"] {
          background: #f8f9fa;
          color: #495057;
          border: 1.5px solid transparent;
        }
        .support-widget-actions button[type="button"]:hover {
          background: #e9ecef;
          border-color: #dee2e6;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }
        .support-widget-actions button[type="submit"] {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          box-shadow: 0 4px 14px rgba(102, 126, 234, 0.35);
        }
        .support-widget-actions button[type="submit"]:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(102, 126, 234, 0.45);
        }
        .support-widget-actions button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .support-widget-message {
          padding: 14px 18px;
          border-radius: 10px;
          font-size: 14px;
          line-height: 1.6;
          font-family: inherit;
        }
        .support-widget-success {
          background: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }
        .support-widget-error {
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }
        .support-widget-tickets-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .support-widget-tickets-header h3 {
          margin: 0;
          font-size: 23px;
          font-weight: 700;
          color: #1a1a1a;
          font-family: inherit;
          letter-spacing: -0.3px;
          line-height: 1.3;
        }
        .support-widget-back-btn {
          padding: 11px 20px;
          background: linear-gradient(to bottom, #ffffff, #f8f9fa);
          border: 1.5px solid rgba(233, 236, 239, 0.8);
          border-radius: 10px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          color: #495057;
          font-family: inherit;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
        }
        .support-widget-back-btn:hover {
          background: linear-gradient(to bottom, #f8f9fa, #ffffff);
          border-color: #dee2e6;
          transform: translateX(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }
        .support-widget-tickets-search {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
        }
        .support-widget-tickets-search input {
          flex: 1;
          padding: 15px 18px;
          border: 1.5px solid #e9ecef;
          border-radius: 12px;
          font-size: 15px;
          font-family: inherit;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
        }
        .support-widget-tickets-search input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.12), 0 2px 8px rgba(102, 126, 234, 0.08);
        }
        .support-widget-tickets-search button {
          padding: 15px 28px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          font-size: 15px;
          font-weight: 600;
          font-family: inherit;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 14px rgba(102, 126, 234, 0.35);
        }
        .support-widget-tickets-search button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(102, 126, 234, 0.45);
        }
        .support-widget-tickets-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .support-widget-ticket-item {
          padding: 20px;
          background: linear-gradient(to bottom, #ffffff, #f8f9fa);
          border-radius: 14px;
          border: 1px solid rgba(233, 236, 239, 0.8);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }
        .support-widget-ticket-item:hover {
          background: linear-gradient(to bottom, #f8f9fa, #ffffff);
          border-color: #667eea;
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.15), 0 2px 8px rgba(0, 0, 0, 0.08);
          transform: translateX(4px) translateY(-2px);
        }
        .support-widget-ticket-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .support-widget-ticket-number {
          font-weight: 700;
          color: #1a1a1a;
          font-size: 15px;
          font-family: inherit;
        }
        .support-widget-ticket-status {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          font-family: inherit;
        }
        .support-widget-status-open { background: #d4edda; color: #155724; }
        .support-widget-status-in_progress { background: #fff3cd; color: #856404; }
        .support-widget-status-resolved { background: #d1ecf1; color: #0c5460; }
        .support-widget-status-closed { background: #d6d8db; color: #383d41; }
        .support-widget-ticket-subject {
          font-weight: 600;
          color: #495057;
          margin-bottom: 8px;
          font-size: 15px;
          font-family: inherit;
        }
        .support-widget-ticket-meta {
          display: flex;
          gap: 16px;
          font-size: 13px;
          color: #6c757d;
          font-family: inherit;
        }
        .support-widget-loading,
        .support-widget-empty,
        .support-widget-error-message {
          padding: 48px 40px;
          text-align: center;
          color: #6c757d;
          font-size: 15px;
          font-family: inherit;
          line-height: 1.6;
        }
        .support-widget-empty {
          color: #6c757d;
          opacity: 0.8;
          font-style: italic;
        }
        .support-widget-error-message {
          color: #721c24;
          background: linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%);
          border-radius: 12px;
          border: 1px solid rgba(114, 28, 36, 0.2);
          box-shadow: 0 2px 8px rgba(114, 28, 36, 0.12);
        }

        /* Chat Popup Styles */
        .support-widget-chat-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }
        .support-widget-chat-title {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
        }
        .support-widget-chat-title h3 {
          margin: 0;
          font-size: 19px;
          font-weight: 700;
          color: #1a1a1a;
          font-family: inherit;
          letter-spacing: -0.2px;
          line-height: 1.3;
        }
        .support-widget-chat-subject {
          font-size: 15px;
          font-weight: 600;
          color: #495057;
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid #e9ecef;
          font-family: inherit;
        }
        .support-widget-chat-messages {
          flex: 1;
          overflow-y: auto;
          max-height: 400px;
          min-height: 300px;
          padding: 20px 0;
          margin-bottom: 18px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          scrollbar-width: thin;
          scrollbar-color: rgba(108, 117, 125, 0.3) transparent;
        }
        .support-widget-chat-messages::-webkit-scrollbar {
          width: 8px;
        }
        .support-widget-chat-messages::-webkit-scrollbar-track {
          background: transparent;
        }
        .support-widget-chat-messages::-webkit-scrollbar-thumb {
          background: rgba(108, 117, 125, 0.3);
          border-radius: 4px;
        }
        .support-widget-chat-messages::-webkit-scrollbar-thumb:hover {
          background: rgba(108, 117, 125, 0.5);
        }
        .support-widget-chat-message {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 14px 18px;
          border-radius: 16px;
          max-width: 80%;
          animation: messageSlideIn 0.35s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
        }
        @keyframes messageSlideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .support-widget-message-user {
          align-self: flex-end;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          margin-left: auto;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.25);
          border: none;
        }
        .support-widget-message-admin {
          align-self: flex-start;
          background: linear-gradient(to bottom, #ffffff, #f8f9fa);
          color: #232347;
          border: 1px solid rgba(233, 236, 239, 0.8);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }
        .support-widget-chat-message-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          font-size: 12px;
          font-family: inherit;
        }
        .support-widget-chat-message-sender {
          font-weight: 600;
          opacity: 0.9;
        }
        .support-widget-message-user .support-widget-chat-message-sender {
          color: rgba(255, 255, 255, 0.9);
        }
        .support-widget-message-admin .support-widget-chat-message-sender {
          color: #8a3b9a;
        }
        .support-widget-chat-message-time {
          opacity: 0.7;
          font-size: 11px;
        }
        .support-widget-chat-message-text {
          font-size: 14px;
          line-height: 1.5;
          word-wrap: break-word;
          font-family: inherit;
        }
        .support-widget-message-user .support-widget-chat-message-text {
          color: white;
        }
        .support-widget-message-admin .support-widget-chat-message-text {
          color: #232347;
        }
        .support-widget-chat-input-area {
          border-top: 1px solid rgba(233, 236, 239, 0.8);
          padding-top: 18px;
          flex-shrink: 0;
          background: linear-gradient(to top, rgba(248, 249, 250, 0.5), transparent);
        }
        .support-widget-chat-input-area textarea {
          width: 100%;
          padding: 14px 18px;
          border: 1.5px solid #e9ecef;
          border-radius: 12px;
          font-size: 14px;
          font-family: inherit;
          resize: vertical;
          min-height: 85px;
          max-height: 150px;
          box-sizing: border-box;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
        }
        .support-widget-chat-input-area textarea:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.12), 0 2px 8px rgba(102, 126, 234, 0.08);
          transform: translateY(-1px);
        }
        .support-widget-chat-file-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 14px;
          padding: 14px;
          background: linear-gradient(to bottom, #ffffff, #f8f9fa);
          border-radius: 12px;
          max-height: 150px;
          overflow-y: auto;
          border: 1px solid rgba(233, 236, 239, 0.6);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }
        .support-widget-chat-file-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 14px;
          background: linear-gradient(to bottom, #ffffff, #f8f9fa);
          border-radius: 8px;
          font-size: 13px;
          font-family: inherit;
          border: 1px solid rgba(233, 236, 239, 0.5);
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
        }
        .support-widget-chat-file-name {
          flex: 1;
          color: #495057;
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .support-widget-chat-file-size {
          color: #6c757d;
          font-size: 12px;
        }
        .support-widget-chat-file-remove {
          background: none;
          border: none;
          color: #dc3545;
          font-size: 20px;
          cursor: pointer;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: background 0.2s;
          font-family: inherit;
        }
        .support-widget-chat-file-remove:hover {
          background: #f8d7da;
        }
        .support-widget-chat-file-uploaded {
          background: #d4edda;
        }
        .support-widget-chat-file-uploaded .support-widget-chat-file-name {
          color: #155724;
        }
        .support-widget-chat-file-status {
          color: #28a745;
          font-weight: 600;
        }
        .support-widget-chat-input-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .support-widget-chat-attach-btn {
          background: none;
          border: none;
          color: #6c757d;
          cursor: pointer;
          padding: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          font-family: inherit;
        }
        .support-widget-chat-attach-btn:hover {
          background: linear-gradient(to bottom, #f8f9fa, #ffffff);
          color: #667eea;
          transform: scale(1.1);
          box-shadow: 0 2px 8px rgba(102, 126, 234, 0.15);
        }
        .support-widget-chat-attachments {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 8px;
        }
        .support-widget-chat-attachment {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          font-size: 13px;
          font-family: inherit;
        }
        .support-widget-message-user .support-widget-chat-attachment {
          background: rgba(255, 255, 255, 0.25);
        }
        .support-widget-message-admin .support-widget-chat-attachment {
          background: #f8f9fa;
        }
        .support-widget-chat-attachment-link {
          display: flex;
          align-items: center;
          gap: 8px;
          color: inherit;
          text-decoration: none;
          flex: 1;
          font-family: inherit;
        }
        .support-widget-chat-attachment-link:hover {
          text-decoration: underline;
        }
        .support-widget-chat-attachment-name {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-weight: 500;
        }
        .support-widget-chat-attachment-size {
          color: rgba(255, 255, 255, 0.7);
          font-size: 12px;
        }
        .support-widget-message-admin .support-widget-chat-attachment-size {
          color: #6c757d;
        }
        .support-widget-chat-attachment-image {
          padding: 0;
          background: transparent;
        }
        .support-widget-chat-attachment-image a {
          display: flex;
          flex-direction: column;
          gap: 8px;
          text-decoration: none;
          color: inherit;
        }
        .support-widget-chat-attachment-image img {
          max-width: 200px;
          max-height: 200px;
          border-radius: 8px;
          object-fit: cover;
          border: 1px solid rgba(0, 0, 0, 0.1);
        }
        .support-widget-message-user .support-widget-chat-attachment-image img {
          border-color: rgba(255, 255, 255, 0.3);
        }
        .support-widget-chat-input-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 8px;
        }
        .support-widget-chat-input-footer button {
          padding: 12px 28px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          font-family: inherit;
          box-shadow: 0 4px 14px rgba(102, 126, 234, 0.35);
        }
        .support-widget-chat-input-footer button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(102, 126, 234, 0.45);
        }
        .support-widget-chat-input-footer button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .support-widget-ticket-item {
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .support-widget-ticket-item:hover {
          transform: translateX(6px) translateY(-2px);
          box-shadow: 0 8px 24px rgba(102, 126, 234, 0.18), 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        /* Responsive */
        @media (max-width: 640px) {
          .support-widget-content {
            max-width: 100%;
            border-radius: 0;
            max-height: 100vh;
          }
          .support-widget-header {
            padding: 20px;
          }
          .support-widget-view {
            padding: 20px;
          }
          .support-widget-actions {
            flex-direction: column;
          }
          .support-widget-actions button {
            width: 100%;
          }
          .support-widget-chat-messages {
            max-height: 300px;
            min-height: 200px;
          }
          .support-widget-chat-message {
            max-width: 85%;
          }
        }
      `;
      document.head.appendChild(style);
    }
  };

  window.SupportWidget = SupportWidget;

})(window, document);
