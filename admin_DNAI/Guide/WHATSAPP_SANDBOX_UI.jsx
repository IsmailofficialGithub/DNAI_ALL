{/* WhatsApp Message Sandbox */ }
{
    activeMainTab === 'whatsapp' && whatsappApplications.some(app => app.status === 'connected') && (
        <Card style={{ marginTop: '24px', border: '1px solid #e5e7eb' }}>
            <Card.Header style={{
                backgroundColor: '#f9fafb',
                borderBottom: '1px solid #e5e7eb',
                padding: '16px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <TestTube size={20} color="#3b82f6" />
                    <h5 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                        Message Sandbox
                    </h5>
                </div>
                <span style={{
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '500',
                    backgroundColor: '#dbeafe',
                    color: '#3b82f6'
                }}>
                    Testing Tool
                </span>
            </Card.Header>
            <Card.Body style={{ padding: '24px' }}>
                <p style={{ fontSize: '14px', color: '#6c757d', marginBottom: '24px' }}>
                    Test sending WhatsApp messages from your connected applications. Enter a phone number and message below.
                </p>

                <Row>
                    <Col md={12} style={{ marginBottom: '20px' }}>
                        <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                            Select Application *
                        </label>
                        <select
                            value={sandboxApp}
                            onChange={(e) => setSandboxApp(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: '1px solid #d1d5db',
                                borderRadius: '8px',
                                fontSize: '14px',
                                outline: 'none',
                                backgroundColor: 'white'
                            }}
                        >
                            <option value="">Choose an application...</option>
                            {whatsappApplications
                                .filter(app => app.status === 'connected')
                                .map(app => (
                                    <option key={app.id} value={app.id}>
                                        {app.name} ({app.phone})
                                    </option>
                                ))}
                        </select>
                    </Col>

                    <Col md={12} style={{ marginBottom: '20px' }}>
                        <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                            Phone Number * (with country code, no +)
                        </label>
                        <input
                            type="text"
                            value={sandboxPhone}
                            onChange={(e) => setSandboxPhone(e.target.value)}
                            placeholder="e.g., 1234567890"
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: '1px solid #d1d5db',
                                borderRadius: '8px',
                                fontSize: '14px',
                                outline: 'none'
                            }}
                        />
                        <small style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px', display: 'block' }}>
                            Format: Country code + number (e.g., 923001234567 for Pakistan)
                        </small>
                    </Col>

                    <Col md={12} style={{ marginBottom: '20px' }}>
                        <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                            Message *
                        </label>
                        <textarea
                            value={sandboxMessage}
                            onChange={(e) => setSandboxMessage(e.target.value)}
                            placeholder="Enter your message here..."
                            rows={4}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: '1px solid #d1d5db',
                                borderRadius: '8px',
                                fontSize: '14px',
                                outline: 'none',
                                resize: 'vertical',
                                fontFamily: 'inherit'
                            }}
                        />
                    </Col>

                    <Col md={12}>
                        <Button
                            variant="primary"
                            onClick={handleSendMessage}
                            disabled={sendingMessage || !sandboxApp || !sandboxPhone || !sandboxMessage}
                            style={{
                                backgroundColor: '#25D366',
                                borderColor: '#25D366',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 20px',
                                borderRadius: '8px'
                            }}
                        >
                            {sendingMessage ? (
                                <>
                                    <div style={{
                                        width: '16px',
                                        height: '16px',
                                        border: '2px solid rgba(255,255,255,0.3)',
                                        borderTop: '2px solid white',
                                        borderRadius: '50%',
                                        animation: 'spin 0.8s linear infinite'
                                    }} />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <MessageSquare size={16} />
                                    Send Message
                                </>
                            )}
                        </Button>
                    </Col>
                </Row>
            </Card.Body>
        </Card>
    )
}
