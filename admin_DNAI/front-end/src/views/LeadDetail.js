import React, { useState, useEffect } from "react";
import { useParams, useHistory } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Spinner,
  Form,
} from "react-bootstrap";
import { getLeadById, updateLead } from "api/backend/genie";
import { usePermissions } from "hooks/usePermissions";
import toast from "react-hot-toast";

function LeadDetail() {
  const { id } = useParams();
  const history = useHistory();
  const { hasPermission } = usePermissions();
  const canUpdate = hasPermission('genie.leads.update');

  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [summary, setSummary] = useState("");

  useEffect(() => {
    if (id) {
      fetchLeadDetails();
    }
  }, [id]);

  const fetchLeadDetails = async () => {
    setLoading(true);
    try {
      const response = await getLeadById(id);
      if (response?.error) {
        toast.error(response.error);
        return;
      }
      setLead(response?.data);
      setSummary(response?.data?.summary || "");
    } catch (error) {
      console.error("Error fetching lead details:", error);
      toast.error("Failed to fetch lead details");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSummary = async () => {
    if (!canUpdate) {
      toast.error("You don't have permission to update leads");
      return;
    }

    setSaving(true);
    try {
      const response = await updateLead(id, { summary });
      if (response?.error) {
        toast.error(response.error);
        return;
      }
      toast.success("Lead updated successfully");
      setEditMode(false);
      fetchLeadDetails(); // Refresh data
    } catch (error) {
      toast.error("Failed to update lead");
    } finally {
      setSaving(false);
    }
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString();
  };

  if (loading) {
    return (
      <Container fluid>
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3 text-muted">Loading lead details...</p>
        </div>
      </Container>
    );
  }

  if (!lead) {
    return (
      <Container fluid>
        <div className="text-center py-5">
          <i className="fa fa-exclamation-triangle text-warning" style={{ fontSize: '48px' }}></i>
          <h5 className="mt-3">Lead Not Found</h5>
          <p className="text-muted">The lead you're looking for doesn't exist or has been deleted.</p>
          <Button variant="primary" onClick={() => history.push('/admin/genie?tab=leads')}>
            <i className="fa fa-arrow-left me-2"></i>
            Back to Genie
          </Button>
        </div>
      </Container>
    );
  }

  return (
    <Container fluid>
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center">
              <Button 
                variant="outline-secondary" 
                size="sm" 
                className="me-3"
                onClick={() => history.push('/admin/genie?tab=leads')}
              >
                <i className="fa fa-arrow-left me-1"></i>
                Back
              </Button>
              <div>
                <h4 className="mb-0" style={{ fontWeight: 600 }}>
                  {/* <i className="fa fa-star me-2" style={{ color: '#f59e0b' }}></i> */}
                  Lead Details
                </h4>
                <small className="text-muted">ID: {id}</small>
              </div>
            </div>
            <span 
              style={{ 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                color: 'white', 
                padding: '6px 16px', 
                borderRadius: '20px',
                fontSize: '0.9rem',
                fontWeight: 600 
              }}
            >
              <i className="fa fa-star me-1"></i>
              Qualified Lead
            </span>
          </div>
        </Col>
      </Row>

      {/* Contact Info */}
      <Row className="mb-4">
        <Col md={6}>
          <Card className="h-100 border-0 shadow-sm">
            <Card.Header className="bg-white border-bottom" style={{ fontWeight: 600 }}>
              <i className="fa fa-user me-2" style={{ color: '#667eea' }}></i>
              Contact Information
            </Card.Header>
            <Card.Body>
              <Row>
                <Col sm={6} className="mb-3">
                  <small className="text-muted d-block">Name</small>
                  <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{lead.name || "Unknown"}</span>
                </Col>
                <Col sm={6} className="mb-3">
                  <small className="text-muted d-block">Phone</small>
                  <a href={`tel:${lead.phone}`} style={{ fontWeight: 500, fontSize: '1rem' }}>{lead.phone}</a>
                </Col>
                {lead.email && (
                  <Col sm={12} className="mb-3">
                    <small className="text-muted d-block">Owner</small>
                    <a href={`mailto:${lead.email}`}>{lead.email}</a>
                  </Col>
                )}
              </Row>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="h-100 border-0 shadow-sm">
            <Card.Header className="bg-white border-bottom" style={{ fontWeight: 600 }}>
              <i className="fa fa-info-circle me-2" style={{ color: '#22c55e' }}></i>
              Lead Information
            </Card.Header>
            <Card.Body>
              <Row>
                <Col sm={6} className="mb-3">
                  <small className="text-muted d-block">Bot</small>
                  <span style={{ fontWeight: 600 }}>{lead.genie_bots?.name || "Unknown"}</span>
                </Col>
                <Col sm={6} className="mb-3">
                  <small className="text-muted d-block">Agent</small>
                  <span>{lead.agent || "-"}</span>
                </Col>
                <Col sm={6} className="mb-3">
                  <small className="text-muted d-block">Created At</small>
                  <span>{formatDate(lead.created_at)}</span>
                </Col>
                {lead.genie_contact_lists?.name && (
                  <Col sm={6} className="mb-3">
                    <small className="text-muted d-block">Contact List</small>
                    <span>{lead.genie_contact_lists.name}</span>
                  </Col>
                )}
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Recording */}
      {lead.recording_url && (
        <Row className="mb-4">
          <Col>
            <Card className="border-0 shadow-sm">
              <Card.Header className="bg-white border-bottom d-flex justify-content-between align-items-center" style={{ fontWeight: 600 }}>
                <span>
                  <i className="fa fa-microphone me-2" style={{ color: '#ef4444' }}></i>
                  Recording
                </span>
                <Button 
                  variant="outline-primary" 
                  size="sm"
                  href={lead.recording_url}
                  target="_blank"
                >
                  <i className="fa fa-download me-1"></i>
                  Download
                </Button>
              </Card.Header>
              <Card.Body>
                <audio controls className="w-100" src={lead.recording_url} style={{ height: '50px' }}>
                  Your browser does not support the audio element.
                </audio>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Summary */}
      <Row className="mb-4">
        <Col>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white border-bottom d-flex justify-content-between align-items-center" style={{ fontWeight: 600 }}>
              <span>
                <i className="fa fa-sticky-note-o me-2" style={{ color: '#667eea' }}></i>
                Summary
              </span>
              {canUpdate && !editMode && (
                <Button 
                  variant="outline-primary" 
                  size="sm"
                  onClick={() => setEditMode(true)}
                >
                  <i className="fa fa-edit me-1"></i>
                  Edit
                </Button>
              )}
            </Card.Header>
            <Card.Body>
              {editMode ? (
                <div>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Add a summary of this lead..."
                  />
                  <div className="mt-3">
                    <Button 
                      variant="primary" 
                      size="sm"
                      onClick={handleSaveSummary}
                      disabled={saving}
                      className="me-2"
                    >
                      {saving ? (
                        <Spinner size="sm" />
                      ) : (
                        <>
                          <i className="fa fa-save me-1"></i>
                          Save
                        </>
                      )}
                    </Button>
                    <Button 
                      variant="outline-secondary" 
                      size="sm"
                      onClick={() => {
                        setEditMode(false);
                        setSummary(lead.summary || "");
                      }}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                  {lead.summary || <span className="text-muted">No summary available. Click Edit to add one.</span>}
                </p>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Transcript */}
      {lead.transcript && (
        <Row className="mb-4">
          <Col>
            <Card className="border-0 shadow-sm">
              <Card.Header className="bg-white border-bottom d-flex justify-content-between align-items-center" style={{ fontWeight: 600 }}>
                <span>
                  <i className="fa fa-file-text-o me-2" style={{ color: '#667eea' }}></i>
                  Transcript
                </span>
                <Button 
                  variant="outline-secondary" 
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(lead.transcript);
                    toast.success("Transcript copied to clipboard");
                  }}
                >
                  <i className="fa fa-copy me-1"></i>
                  Copy
                </Button>
              </Card.Header>
              <Card.Body>
                <div 
                  style={{ 
                    maxHeight: '400px', 
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    fontSize: '0.9rem',
                    backgroundColor: '#f8fafc',
                    padding: '16px',
                    borderRadius: '8px',
                    lineHeight: 1.8,
                  }}
                >
                  {lead.transcript}
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Metadata */}
      {lead.metadata && Object.keys(lead.metadata).length > 0 && (
        <Row className="mb-4">
          <Col>
            <Card className="border-0 shadow-sm">
              <Card.Header className="bg-white border-bottom" style={{ fontWeight: 600 }}>
                <i className="fa fa-database me-2" style={{ color: '#64748b' }}></i>
                Additional Data
              </Card.Header>
              <Card.Body>
                <pre 
                  style={{ 
                    backgroundColor: '#f8fafc',
                    padding: '16px',
                    borderRadius: '8px',
                    maxHeight: '200px',
                    overflow: 'auto',
                    fontSize: '0.9rem',
                    margin: 0,
                  }}
                >
                  {JSON.stringify(lead.metadata, null, 2)}
                </pre>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
    </Container>
  );
}

export default LeadDetail;

