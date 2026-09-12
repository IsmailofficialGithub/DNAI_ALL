import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, CircleArrowOutUpRight, Play, FileText, MoreVertical, Eye, Copy, Download, Search, X, Pause } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface RecentCallData {
  id: string;
  dateTime: string;
  caller: string;
  called: string;
  status: string;
  duration: string;
  hasRecording: boolean;
  hasTranscript: boolean;
  transcript?: string | null;
  recordingUrl?: string | null;
  cost?: string;
  agentName?: string;
  isLead?: boolean;
}

interface RecentCallsTableProps {
  calls: RecentCallData[];
  onViewMore?: () => void;
}

const RecentCallsTable: React.FC<RecentCallsTableProps> = ({ calls, onViewMore }) => {
  const navigate = useNavigate();
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectedTranscript, setSelectedTranscript] = useState<{ id: string; transcript: string; caller: string; called: string; dateTime: string } | null>(null);
  const [selectedCall, setSelectedCall] = useState<RecentCallData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(null);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      Object.values(audioRefs.current).forEach(audio => {
        if (audio) {
          audio.pause();
          audio.src = '';
        }
      });
    };
  }, []);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ column }: { column: string }) => (
    <button
      onClick={() => handleSort(column)}
      className="flex items-center gap-1 hover:opacity-70 transition-opacity"
    >
      <ArrowUpDown className="w-4 h-4 dark:text-[#f9fafb] text-black" />
    </button>
  );

  const getStatusBadgeClass = (status: string) => {
    if (status === 'Answered') {
      return 'bg-[#ebf9f1] text-[#1f9254]';
    } else if (status === 'Forwarded') {
      return 'bg-[#e0f2fe] text-[#0369a1]';
    } else {
      return 'bg-[#fee2e2] text-[#dc2626]';
    }
  };

  const handleViewTranscript = (call: RecentCallData) => {
    if (call.transcript) {
      setSelectedTranscript({
        id: call.id,
        transcript: call.transcript,
        caller: call.caller,
        called: call.called,
        dateTime: call.dateTime,
      });
      setSearchQuery('');
    }
  };

  const handleCopyTranscript = () => {
    if (selectedTranscript) {
      navigator.clipboard.writeText(selectedTranscript.transcript);
    }
  };

  const handleDownloadTranscript = () => {
    if (selectedTranscript) {
      const blob = new Blob([selectedTranscript.transcript], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transcript-${selectedTranscript.id}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const highlightSearchText = (text: string, query: string) => {
    if (!query.trim()) return text;

    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-800">{part}</mark>
      ) : (
        part
      )
    );
  };

  const filteredTranscript = selectedTranscript
    ? (searchQuery.trim()
      ? selectedTranscript.transcript.split('\n').filter(line =>
        line.toLowerCase().includes(searchQuery.toLowerCase())
      ).join('\n')
      : selectedTranscript.transcript)
    : '';

  const handlePlayRecording = (recordingUrl: string, callId: string) => {
    // Stop any other currently playing audio (but don't reset their position)
    Object.entries(audioRefs.current).forEach(([id, audio]) => {
      if (id !== callId && audio && !audio.paused) {
        audio.pause();
        setPlayingRecordingId(null);
      }
    });

    // If clicking the same recording, toggle play/pause
    if (playingRecordingId === callId && audioRefs.current[callId]) {
      const audio = audioRefs.current[callId];
      if (!audio.paused) {
        // Pause the audio (keep current position)
        audio.pause();
        setPlayingRecordingId(null);
      } else {
        // Resume from where it was paused
        audio.play();
        setPlayingRecordingId(callId);
      }
      return;
    }

    // Create or get audio element
    if (!audioRefs.current[callId]) {
      const audio = new Audio(recordingUrl);
      audioRefs.current[callId] = audio;

      audio.onended = () => {
        setPlayingRecordingId(null);
      };

      audio.onerror = () => {
        console.error('Error playing recording');
        setPlayingRecordingId(null);
      };
    }

    const audio = audioRefs.current[callId];
    audio.play();
    setPlayingRecordingId(callId);
  };

  const handleViewCall = (call: RecentCallData) => {
    setSelectedCall(call);
    // Stop any playing audio when opening dialog
    if (playingRecordingId) {
      Object.entries(audioRefs.current).forEach(([id, audio]) => {
        if (audio && !audio.paused) {
          audio.pause();
          audio.currentTime = 0;
        }
      });
      setPlayingRecordingId(null);
    }
  };

  // Stop all audio when dialog closes
  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setSelectedCall(null);
      // Stop all playing audio
      Object.entries(audioRefs.current).forEach(([id, audio]) => {
        if (audio && !audio.paused) {
          audio.pause();
          audio.currentTime = 0;
        }
      });
      setPlayingRecordingId(null);
    }
  };

  return (
    <Card className="dark:bg-[#1d212b] bg-[#f8f8f8] dark:border-[#2f3541] border border-[#f0f0f0] rounded-[14px] overflow-hidden w-full" style={{ fontFamily: "'Manrope', sans-serif" }}>
      <CardContent className="p-5 flex flex-col gap-[10px] w-full">
        {/* Header with Title */}
        {/* Header with Title and View More Button */}
        <div className="flex items-start justify-between pb-4">
          <p className="text-[18px] font-bold dark:text-[#f9fafb] text-[#0a0a0a]">Call History</p>
          <Button
            onClick={onViewMore}
            variant="outline"
            className="h-9 dark:border-[#00c19c] dark:text-[#00c19c] border-[#00c19c] rounded-[8px] text-[16px] font-medium text-[#27272b] hover:bg-[#00c19c] hover:text-white dark:hover:bg-[#00c19c] dark:hover:text-white transition-colors"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            <CircleArrowOutUpRight className="w-5 h-5 mr-2" />
            View More
          </Button>
        </div>

        {/* Table */}
        <div className="dark:border-[#2f3541] border border-[#e5e5e5] rounded-[8px] w-full overflow-x-auto">
          {/* Header Row */}
          <div className="dark:bg-[#2f3541] dark:border-[#3a4150] bg-white border-b border-[#e5e5e5] flex gap-4 items-center py-[10px] px-4 min-w-max">
            <div className="flex gap-1 items-center flex-1 min-w-[140px]">
              <p className="text-[14px] font-bold dark:text-[#f9fafb] text-black leading-normal">Date & Time</p>
              <SortIcon column="dateTime" />
            </div>
            <div className="flex gap-1 items-center flex-1 min-w-[120px]">
              <p className="text-[14px] font-bold dark:text-[#f9fafb] text-black leading-normal">Caller</p>
              <SortIcon column="caller" />
            </div>
            <div className="flex gap-1 items-center flex-1 min-w-[120px]">
              <p className="text-[14px] font-bold dark:text-[#f9fafb] text-black leading-normal">Called</p>
              <SortIcon column="called" />
            </div>
            <div className="flex gap-1 items-center flex-1 min-w-[100px]">
              <p className="text-[14px] font-bold dark:text-[#f9fafb] text-black leading-normal">Status</p>
              <SortIcon column="status" />
            </div>
            <div className="flex gap-1 items-center flex-1 min-w-[100px]">
              <p className="text-[14px] font-bold dark:text-[#f9fafb] text-black leading-normal">Duration</p>
              <SortIcon column="duration" />
            </div>
            <div className="flex gap-1 items-center flex-1 min-w-[100px]">
              <p className="text-[14px] font-bold dark:text-[#f9fafb] text-black leading-normal">Recording</p>
              <SortIcon column="recording" />
            </div>
            <div className="flex gap-1 items-center flex-1 min-w-[100px]">
              <p className="text-[14px] font-bold dark:text-[#f9fafb] text-black leading-normal">Transcript</p>
              <SortIcon column="transcript" />
            </div>
            <div className="flex gap-1 items-center w-[80px] shrink-0">
              <p className="text-[14px] font-bold dark:text-[#f9fafb] text-black leading-normal">Actions</p>
              <SortIcon column="actions" />
            </div>
          </div>

          {/* Data Rows */}
          <div className="bg-card text-foreground border-border">
            {calls.length === 0 ? (
              <div className="px-4 py-16 text-center">
                <p className="text-[14px] font-medium dark:text-[#818898] text-[#737373]">No calls found</p>
              </div>
            ) : (
              calls.map((call, index) => (
                <div
                  key={call.id}
                  className={`flex gap-4 items-center py-3 px-4 min-w-max ${index !== calls.length - 1 ? 'dark:border-[#3a4150] border-b border-[#e5e5e5]' : ''
                    } ${index % 2 === 0 ? 'bg-card text-foreground border-border' : 'dark:bg-[#2f3541] bg-[#f8f8f8]'}`}
                >
                  <div className="flex items-center flex-1 min-w-[140px]">
                    <p className="text-[14px] font-medium dark:text-[#f9fafb] text-black leading-normal truncate">
                      {call.dateTime || '-'}
                    </p>
                  </div>
                  <div className="flex items-center flex-1 min-w-[120px]">
                    <p className="text-[14px] font-medium dark:text-[#f9fafb] text-black leading-normal truncate">
                      {call.caller || '-'}
                    </p>
                  </div>
                  <div className="flex items-center flex-1 min-w-[120px]">
                    <p className="text-[14px] font-medium dark:text-[#f9fafb] text-black leading-normal truncate">
                      {call.called || '-'}
                    </p>
                  </div>
                  <div className="flex items-center flex-1 min-w-[100px]">
                    <div className={`${getStatusBadgeClass(call.status)} flex items-center justify-center px-3 py-2 rounded-[22px]`}>
                      <p className="text-[12px] font-medium leading-normal">
                        {call.status || '-'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center flex-1 min-w-[100px]">
                    <p className="text-[14px] font-medium dark:text-[#f9fafb] text-black leading-normal truncate">
                      {call.duration || '-'}
                    </p>
                  </div>
                  <div className="flex items-center flex-1 min-w-[100px]">
                    {call.hasRecording && call.recordingUrl ? (
                      <button
                        onClick={() => handlePlayRecording(call.recordingUrl!, call.id)}
                        className="flex items-center justify-center hover:opacity-70 transition-opacity cursor-pointer"
                        title={playingRecordingId === call.id ? 'Pause Recording' : 'Play Recording'}
                      >
                        {playingRecordingId === call.id ? (
                          <Pause className="w-4 h-4 dark:text-[#f9fafb] text-black" />
                        ) : (
                          <Play className="w-4 h-4 dark:text-[#f9fafb] text-black" />
                        )}
                      </button>
                    ) : (
                      <span className="text-[14px] font-medium dark:text-[#818898] text-[#737373]">-</span>
                    )}
                  </div>
                  <div className="flex items-center flex-1 min-w-[100px]">
                    {call.hasTranscript && call.transcript ? (
                      <button
                        onClick={() => handleViewTranscript(call)}
                        className="flex items-center justify-center hover:opacity-70 transition-opacity cursor-pointer"
                        title="View Transcript"
                      >
                        <FileText className="w-4 h-4 dark:text-[#f9fafb] text-black" />
                      </button>
                    ) : (
                      <span className="text-[14px] font-medium dark:text-[#818898] text-[#737373]">-</span>
                    )}
                  </div>
                  <div className="flex items-center w-[80px] shrink-0">
                    <DropdownMenu open={openMenuId === call.id} onOpenChange={(open) => setOpenMenuId(open ? call.id : null)}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[91px] p-1">
                        <DropdownMenuItem onClick={() => handleViewCall(call)} className="gap-2 text-[14px]">
                          <Eye className="w-4 h-4" />
                          View
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>


      </CardContent>

      {/* Transcript Dialog */}
      <Dialog open={!!selectedTranscript} onOpenChange={(open) => !open && setSelectedTranscript(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col bg-card text-foreground border-border">
          <DialogHeader>
            <DialogTitle className="text-[20px] font-bold dark:text-[#f9fafb] text-[#0a0a0a]">
              Call Transcript
            </DialogTitle>
            <DialogDescription className="dark:text-[#818898] text-[#737373]">
              {selectedTranscript && (
                <>
                  <div className="mt-2 space-y-1">
                    <p><span className="font-medium">Caller:</span> {selectedTranscript.caller}</p>
                    <p><span className="font-medium">Called:</span> {selectedTranscript.called}</p>
                    <p><span className="font-medium">Date & Time:</span> {selectedTranscript.dateTime}</p>
                  </div>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Search Bar */}
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 dark:text-[#818898] text-[#737373]" />
              <Input
                placeholder="Search in transcript..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-9 dark:bg-[#2f3541] dark:border-[#2f3541] dark:text-[#f9fafb] bg-white border-[#e5e5e5] rounded-[8px] text-[14px]"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                >
                  <X className="w-4 h-4 dark:text-[#818898] text-[#737373]" />
                </button>
              )}
            </div>
          </div>

          {/* Transcript Content */}
          <div className="flex-1 overflow-y-auto border dark:border-[#2f3541] border-[#e5e5e5] rounded-[8px] p-4 dark:bg-[#2f3541] bg-[#f8f8f8]">
            {selectedTranscript && (
              <div className="whitespace-pre-wrap text-[14px] leading-relaxed dark:text-[#f9fafb] text-[#0a0a0a] font-normal">
                {searchQuery.trim()
                  ? highlightSearchText(filteredTranscript, searchQuery)
                  : selectedTranscript.transcript.split('\n').map((line, i) => (
                    <React.Fragment key={i}>
                      {highlightSearchText(line, searchQuery)}
                      {'\n'}
                    </React.Fragment>
                  ))
                }
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                onClick={handleCopyTranscript}
                variant="outline"
                className="h-9 dark:border-[#2f3541] dark:text-[#f9fafb] border-[#d4d4da] rounded-[8px] text-[14px] font-medium"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </Button>
              <Button
                onClick={handleDownloadTranscript}
                variant="outline"
                className="h-9 dark:border-[#2f3541] dark:text-[#f9fafb] border-[#d4d4da] rounded-[8px] text-[14px] font-medium"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
            <Button
              onClick={() => setSelectedTranscript(null)}
              className="h-9 bg-[#00c19c] text-white rounded-[8px] text-[14px] font-medium hover:bg-[#00c19c]/90"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Call Details Dialog */}
      <Dialog open={!!selectedCall} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col bg-card text-foreground border-border">
          <DialogHeader>
            <DialogTitle className="text-[20px] font-bold dark:text-[#f9fafb] text-[#0a0a0a]">
              Call Details
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Call Information */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[12px] font-medium dark:text-[#818898] text-[#737373] mb-1">Caller</p>
                <p className="text-[14px] font-medium dark:text-[#f9fafb] text-[#0a0a0a]">{selectedCall?.caller || '-'}</p>
              </div>
              <div>
                <p className="text-[12px] font-medium dark:text-[#818898] text-[#737373] mb-1">Called</p>
                <p className="text-[14px] font-medium dark:text-[#f9fafb] text-[#0a0a0a]">{selectedCall?.called || '-'}</p>
              </div>
              <div>
                <p className="text-[12px] font-medium dark:text-[#818898] text-[#737373] mb-1">Date & Time</p>
                <p className="text-[14px] font-medium dark:text-[#f9fafb] text-[#0a0a0a]">{selectedCall?.dateTime || '-'}</p>
              </div>
              <div>
                <p className="text-[12px] font-medium dark:text-[#818898] text-[#737373] mb-1">Duration</p>
                <p className="text-[14px] font-medium dark:text-[#f9fafb] text-[#0a0a0a]">{selectedCall?.duration || '-'}</p>
              </div>
              <div>
                <p className="text-[12px] font-medium dark:text-[#818898] text-[#737373] mb-1">Status</p>
                <div className={`${getStatusBadgeClass(selectedCall?.status || '')} inline-flex items-center justify-center px-3 py-1 rounded-[22px]`}>
                  <p className="text-[12px] font-medium leading-normal">
                    {selectedCall?.status || '-'}
                  </p>
                </div>
              </div>
              {selectedCall?.cost && (
                <div>
                  <p className="text-[12px] font-medium dark:text-[#818898] text-[#737373] mb-1">Cost</p>
                  <p className="text-[14px] font-medium dark:text-[#f9fafb] text-[#0a0a0a]">{selectedCall.cost}</p>
                </div>
              )}
              {selectedCall?.agentName && (
                <div>
                  <p className="text-[12px] font-medium dark:text-[#818898] text-[#737373] mb-1">Agent</p>
                  <p className="text-[14px] font-medium dark:text-[#f9fafb] text-[#0a0a0a]">{selectedCall.agentName}</p>
                </div>
              )}
              {selectedCall?.isLead !== undefined && (
                <div>
                  <p className="text-[12px] font-medium dark:text-[#818898] text-[#737373] mb-1">Lead</p>
                  <p className="text-[14px] font-medium dark:text-[#f9fafb] text-[#0a0a0a]">{selectedCall.isLead ? 'Yes' : 'No'}</p>
                </div>
              )}
            </div>

            {/* Recording Player */}
            {selectedCall?.hasRecording && selectedCall?.recordingUrl && (
              <div className="border dark:border-[#2f3541] border-[#e5e5e5] rounded-[8px] p-4 dark:bg-[#2f3541] bg-[#f8f8f8]">
                <p className="text-[14px] font-medium dark:text-[#f9fafb] text-[#0a0a0a] mb-3">Recording</p>
                <div className="flex items-center gap-3">
                  <audio
                    ref={(el) => {
                      if (el) {
                        const audioId = `dialog-${selectedCall.id}`;
                        audioRefs.current[audioId] = el;
                        el.addEventListener('play', () => {
                          // Stop other audio when this one plays
                          Object.entries(audioRefs.current).forEach(([id, a]) => {
                            if (id !== audioId && a && !a.paused) {
                              a.pause();
                            }
                          });
                          setPlayingRecordingId(audioId);
                        });
                        el.addEventListener('pause', () => {
                          setPlayingRecordingId(null);
                        });
                        el.addEventListener('ended', () => {
                          setPlayingRecordingId(null);
                        });
                      }
                    }}
                    src={selectedCall.recordingUrl}
                    className="w-full"
                    controls
                  />
                </div>
              </div>
            )}

            {/* Transcript */}
            {selectedCall?.hasTranscript && selectedCall?.transcript && (
              <div className="border dark:border-[#2f3541] border-[#e5e5e5] rounded-[8px] p-4 dark:bg-[#2f3541] bg-[#f8f8f8]">
                <p className="text-[14px] font-medium dark:text-[#f9fafb] text-[#0a0a0a] mb-3">Transcript</p>
                <div className="whitespace-pre-wrap text-[14px] leading-relaxed dark:text-[#f9fafb] text-[#0a0a0a] font-normal max-h-60 overflow-y-auto">
                  {selectedCall.transcript}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={() => setSelectedCall(null)}
              className="h-9 bg-[#00c19c] text-white rounded-[8px] text-[14px] font-medium hover:bg-[#00c19c]/90"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default RecentCallsTable;
