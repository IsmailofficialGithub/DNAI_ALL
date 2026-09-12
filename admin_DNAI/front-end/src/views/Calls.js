import React, { useState, useEffect, useRef } from 'react';
import { Search, Phone, Calendar, User, Play, Pause, Loader } from 'lucide-react';
import { Container, Row, Col, Card, Form, Button, Table, Badge, InputGroup } from 'react-bootstrap';
import toast from 'react-hot-toast';
import callLogsApi from '../api/backend/callLogs';

const Calls = () => {
  const [phone, setPhone] = useState('');
  const [callLogs, setCallLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [playingAudio, setPlayingAudio] = useState(null);
  const audioRefs = useRef({});


  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!phone || !phone.trim()) {
      toast.error('Please enter a phone number');
      return;
    }

    setLoading(true);
    try {
      const params = {};
      if (phone.trim()) params.phone = phone.trim();

      const response = await callLogsApi.getCallLogs(params);
      
      // Axios returns response.data, so response is already the data object
      // Check if response has success property (it should be the API response directly)
      if (response && response.success) {
        const logs = response.data?.call_logs || (response.data?.call_log ? [response.data.call_log] : []);
        setCallLogs(logs);
        if (logs.length === 0) {
          toast('No call logs found for the provided phone number', {
            icon: 'ℹ️',
            duration: 4000,
          });
        } else {
          toast.success(`Found ${logs.length} call log(s)`);
        }
      } else if (response && response.data) {
        // Handle case where response structure is different
        const logs = response.data.call_logs || (response.data.call_log ? [response.data.call_log] : []);
        setCallLogs(logs);
        if (logs.length === 0) {
          toast('No call logs found for the provided phone number', {
            icon: 'ℹ️',
            duration: 4000,
          });
        } else {
          toast.success(`Found ${logs.length} call log(s)`);
        }
      } else {
        throw new Error(response?.error?.message || 'Failed to fetch call logs');
      }
    } catch (error) {
      console.error('Error fetching call logs:', error);
      // Handle different error formats
      const errorMessage = error.response?.data?.error?.message 
        || error.response?.data?.message 
        || error.message 
        || 'Failed to fetch call logs';
      toast.error(errorMessage);
      setCallLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayPause = (logId, callUrl) => {
    const audio = audioRefs.current[logId];
    
    if (!audio) return;

    // If clicking on the same audio that's playing, pause it
    if (playingAudio === logId && !audio.paused) {
      audio.pause();
      setPlayingAudio(null);
      return;
    }

    // Pause any currently playing audio
    Object.values(audioRefs.current).forEach(audioEl => {
      if (audioEl && !audioEl.paused) {
        audioEl.pause();
      }
    });

    // Play the selected audio
    audio.src = callUrl;
    audio.play()
      .then(() => {
        setPlayingAudio(logId);
      })
      .catch(error => {
        console.error('Error playing audio:', error);
        toast.error('Failed to play audio. Please check the URL.');
      });
  };

  const handleAudioEnded = (logId) => {
    setPlayingAudio(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    if (!status) return <Badge bg="secondary">N/A</Badge>;
    const statusConfig = {
      completed: { bg: 'success', text: 'Completed' },
      missed: { bg: 'danger', text: 'Missed' },
      voicemail: { bg: 'warning', text: 'Voicemail' },
      ongoing: { bg: 'info', text: 'Ongoing' },
      in_progress: { bg: 'primary', text: 'In Progress' },
    };
    const config = statusConfig[status.toLowerCase()] || { bg: 'secondary', text: status };
    return (
      <Badge bg={config.bg} className="text-capitalize">
        {config.text}
      </Badge>
    );
  };

  // Pagination
  const totalPages = Math.ceil(callLogs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLogs = callLogs.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Container fluid className="py-4" style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Row className="justify-content-center">
        <Col lg={10} xl={11}>
          {/* Header Card */}
          <Card className="mb-4 shadow-sm">
            <Card.Body className="p-4">
              <h2 className="mb-4 d-flex align-items-center">
                Call Logs
              </h2>
              <p className="text-muted mb-4">
                Enter your phone number to view your call history
              </p>

              {/* Search Form */}
              <Form onSubmit={handleSearch}>
                <Row>
                  <Col md={10}>
                    <Form.Group className="mb-3">
                      <Form.Label className="d-flex align-items-center">
                        <Phone className="me-2" size={14} />
                        Phone Number <span className="text-danger ms-1">*</span>
                      </Form.Label>
                      <Form.Control
                        type="tel"
                        placeholder="Enter your phone number"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        disabled={loading}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={2} className="d-flex align-items-end">
                    <Button
                      type="submit"
                      variant="primary"
                      className="w-100 d-flex align-items-center justify-content-center mb-3"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader className="me-2" size={16} />
                          Searching...
                        </>
                      ) : (
                        <>
                          <span className="me-2 d-flex align-items-center">
                            <Search size={16} />
                          </span>
                          <span style={{ marginLeft: '4px' }}>Search</span>
                        </>
                      )}
                    </Button>
                  </Col>
                </Row>
              </Form>
            </Card.Body>
          </Card>

          {/* Call Logs Table */}
          {callLogs.length > 0 && (
            <Card className="shadow-sm">
              <Card.Body className="p-0">
                <div className="table-responsive">
                  <Table hover className="mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Date & Time</th>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Agent</th>
                        <th>Status</th>
                        <th>Call Recording</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedLogs.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="text-center py-4 text-muted">
                            No call logs found
                          </td>
                        </tr>
                      ) : (
                        paginatedLogs.map((log) => (
                          <tr key={log.id}>
                            <td>
                              <div className="d-flex align-items-center">
                                <Calendar className="me-2" size={16} />
                                <small>{formatDate(log.created_at)}</small>
                              </div>
                            </td>
                            <td>
                              <div className="d-flex align-items-center">
                                <User className="me-2" size={16} />
                                {log.name || 'N/A'}
                              </div>
                            </td>
                            <td>
                              <small>{log.phone || 'N/A'}</small>
                            </td>
                            <td>
                              <small>{log.agent || 'N/A'}</small>
                            </td>
                            <td>
                              {getStatusBadge(log.call_status)}
                            </td>
                            <td>
                              {log.call_url ? (
                                <div className="d-flex align-items-center">
                                  <audio
                                    ref={(el) => {
                                      if (el) {
                                        audioRefs.current[log.id] = el;
                                      } else {
                                        delete audioRefs.current[log.id];
                                      }
                                    }}
                                    onEnded={() => handleAudioEnded(log.id)}
                                    preload="none"
                                  />
                                  <Button
                                    variant={playingAudio === log.id ? "danger" : "success"}
                                    size="sm"
                                    onClick={() => handlePlayPause(log.id, log.call_url)}
                                    className="me-2"
                                  >
                                    {playingAudio === log.id ? (
                                      <>
                                        <Pause size={14} className="me-1" />
                                        Pause
                                      </>
                                    ) : (
                                      <>
                                        <Play size={14} className="me-1" />
                                        Play
                                      </>
                                    )}
                                  </Button>
                                  <a
                                    href={log.call_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-sm btn-outline-primary"
                                  >
                                    Open
                                  </a>
                                </div>
                              ) : (
                                <small className="text-muted">No recording</small>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="d-flex justify-content-between align-items-center p-3 border-top">
                    <div>
                      <small className="text-muted">
                        Showing {startIndex + 1} to {Math.min(endIndex, callLogs.length)} of {callLogs.length} results
                      </small>
                    </div>
                    <div>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="me-2"
                      >
                        Previous
                      </Button>
                      <span className="mx-2">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </Card.Body>
            </Card>
          )}

          {/* Empty State */}
          {!loading && callLogs.length === 0 && (
            <Card className="shadow-sm">
              <Card.Body className="text-center py-5">
                <Phone size={48} className="text-muted mb-3" />
                <h5 className="text-muted">No Call Logs Found</h5>
                <p className="text-muted">
                  Enter your phone number above to search for your call logs
                </p>
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>
    </Container>
  );
};

export default Calls;

