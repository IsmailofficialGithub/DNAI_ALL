import React, { useState, useEffect } from "react";
import { useParams, useHistory } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Spinner,
} from "react-bootstrap";
import { getCallById } from "api/backend/genie";
import toast from "react-hot-toast";

function CallDetail() {
  const { id } = useParams();
  const history = useHistory();
  const [call, setCall] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchCallDetails();
    }
  }, [id]);

  const fetchCallDetails = async () => {
    setLoading(true);
    try {
      const response = await getCallById(id);
      if (response?.error) {
        toast.error(response.error);
        return;
      }
      setCall(response?.data);
    } catch (error) {
      console.error("Error fetching call details:", error);
      toast.error("Failed to fetch call details");
    } finally {
      setLoading(false);
    }
  };

  // Format duration
  const formatDuration = (seconds) => {
    if (!seconds) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString();
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
      in_progress: { bg: '#dbeafe', color: '#1e40af', label: 'In Progress' },
      completed: { bg: '#dcfce7', color: '#166534', label: 'Completed' },
      failed: { bg: '#fee2e2', color: '#991b1b', label: 'Failed' },
      cancelled: { bg: '#f3f4f6', color: '#374151', label: 'Cancelled' },
    };
    const config = statusConfig[status] || { bg: '#f3f4f6', color: '#374151', label: status };
    return (
      <span style={{ 
        background: config.bg, 
        color: config.color, 
        padding: '4px 12px', 
        borderRadius: '20px',
        fontSize: '0.8rem',
        fontWeight: 600 
      }}>
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <Container fluid>
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3 text-muted">Loading call details...</p>
        </div>
      </Container>
    );
  }

  if (!call) {
    return (
      <Container fluid>
        <div className="text-center py-5">
          <i className="fa fa-exclamation-triangle text-warning" style={{ fontSize: '48px' }}></i>
          <h5 className="mt-3">Call Not Found</h5>
          <p className="text-muted">The call you're looking for doesn't exist or has been deleted.</p>
          <Button variant="primary" onClick={() => history.push('/admin/genie')}>
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
                onClick={() => history.push('/admin/genie')}
              >
                <i className="fa fa-arrow-left me-1"></i>
                Back
              </Button>
              <div>
                <h4 className="mb-0" style={{ fontWeight: 600,marginLeft: '10px' }}>
                  {/* <i className="fa fa-phone me-2" style={{ color: '#667eea' }}></i> */}
                  Call Details
                </h4>
                <small className="text-muted">ID: {id}</small>
              </div>
            </div>
            <div>
              {getStatusBadge(call.call_status)}
              {call.is_lead && (
                <span 
                  className="ms-2"
                  style={{ 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                    color: 'white', 
                    padding: '4px 12px', 
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: 600 
                  }}
                >
                  <i className="fa fa-star me-1"></i>
                  Lead
                </span>
              )}
            </div>
          </div>
        </Col>
      </Row>

      {/* Call Info Cards */}
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
                  <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{call.name || "Unknown"}</span>
                </Col>
                <Col sm={6} className="mb-3">
                  <small className="text-muted d-block">Phone</small>
                  <a href={`tel:${call.phone}`} style={{ fontWeight: 500 }}>{call.phone}</a>
                </Col>
                {call.consumer_name && (
                  <Col sm={6} className="mb-3">
                    <small className="text-muted d-block">Consumer Name</small>
                    <span style={{ fontWeight: 600 }}>{call.consumer_name}</span>
                  </Col>
                )}
                {call.consumer_email && (
                  <Col sm={6} className="mb-3">
                    <small className="text-muted d-block">Consumer Email</small>
                    <a href={`mailto:${call.consumer_email}`}>{call.consumer_email}</a>
                  </Col>
                )}
                {call.genie_contacts?.email && (
                  <Col sm={6} className="mb-3">
                    <small className="text-muted d-block">Email</small>
                    <a href={`mailto:${call.genie_contacts.email}`}>{call.genie_contacts.email}</a>
                  </Col>
                )}
                {call.genie_contact_lists?.name && (
                  <Col sm={6} className="mb-3">
                    <small className="text-muted d-block">Contact List</small>
                    <span>{call.genie_contact_lists.name}</span>
                  </Col>
                )}
              </Row>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="h-100 border-0 shadow-sm">
            <Card.Header className="bg-white border-bottom" style={{ fontWeight: 600 }}>
              <i className="fa fa-phone me-2" style={{ color: '#22c55e' }}></i>
              Call Information
            </Card.Header>
            <Card.Body>
              <Row>
                <Col sm={6} className="mb-3">
                  <small className="text-muted d-block">Bot</small>
                  <span style={{ fontWeight: 600 }}>{call.genie_bots?.name || "Unknown"}</span>
                </Col>
                <Col sm={6} className="mb-3">
                  <small className="text-muted d-block">Duration</small>
                  <span style={{ fontWeight: 500 }}>{formatDuration(call.duration)}</span>
                </Col>
                <Col sm={6} className="mb-3">
                  <small className="text-muted d-block">Call Type</small>
                  <span>{call.call_type || "-"}</span>
                </Col>
                {call.end_reason && (
                  <Col sm={6} className="mb-3">
                    <small className="text-muted d-block">End Reason</small>
                    <span>{call.end_reason}</span>
                  </Col>
                )}
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Timeline */}
      <Row className="mb-4">
        <Col>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white border-bottom" style={{ fontWeight: 600 }}>
              <i className="fa fa-clock-o me-2" style={{ color: '#f59e0b' }}></i>
              Timeline
            </Card.Header>
            <Card.Body>
              <Row className="text-center">
                <Col md={4} className="border-end">
                  <small className="text-muted d-block mb-1">Started At</small>
                  <span style={{ fontWeight: 500 }}>{formatDate(call.started_at)}</span>
                </Col>
                <Col md={4} className="border-end">
                  <small className="text-muted d-block mb-1">Ended At</small>
                  <span style={{ fontWeight: 500 }}>{formatDate(call.ended_at)}</span>
                </Col>
                <Col md={4}>
                  <small className="text-muted d-block mb-1">Created At</small>
                  <span style={{ fontWeight: 500 }}>{formatDate(call.created_at)}</span>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Recording */}
      {call.call_url && (
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
                  href={call.call_url}
                  target="_blank"
                >
                  <i className="fa fa-download me-1"></i>
                  Download
                </Button>
              </Card.Header>
              <Card.Body>
                <audio controls className="w-100" src={call.call_url} style={{ height: '50px' }}>
                  Your browser does not support the audio element.
                </audio>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Transcript */}
      {call.transcript && (
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
                    navigator.clipboard.writeText(call.transcript);
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
                  {call.transcript}
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
    </Container>
  );
}

export default CallDetail;

