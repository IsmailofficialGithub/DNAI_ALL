import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { 
  Linkedin, 
  Twitter, 
  Instagram, 
  Facebook, 
  Youtube,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Heart,
  MessageCircle,
  Share2,
  Eye,
  Repeat2,
  Music,
  MoreHorizontal,
  Bookmark,
  ThumbsUp,
  ThumbsDown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface PlatformPreviewProps {
  platform: string;
  topic: string;
  content: string;
  mediaUrls?: string[]; // Changed to array for carousel support
  hashtags?: string[];
  scheduledAt?: string;
  brandName?: string;
}

// Platform-specific styling and behavior
const getPlatformMeta = (platform: string) => {
  const normalizedPlatform = platform.toLowerCase();
  
  switch (normalizedPlatform) {
    case 'tiktok':
      return {
        icon: Music,
        label: 'TikTok',
        accent: 'bg-black',
        textColor: 'text-black',
        borderColor: 'border-gray-300',
        bgColor: 'bg-black',
        aspectRatio: 'aspect-[9/16]', // Vertical video
        isVideo: true,
        autoPlay: true,
        muted: true,
        loop: true
      };
    case 'linkedin':
      return {
        icon: Linkedin,
        label: 'LinkedIn',
        accent: 'bg-blue-600',
        textColor: 'text-blue-600',
        borderColor: 'border-blue-200',
        bgColor: 'bg-blue-50',
        aspectRatio: 'aspect-[4/3]',
        isVideo: false,
        autoPlay: false
      };
    case 'instagram':
      return {
        icon: Instagram,
        label: 'Instagram',
        accent: 'bg-gradient-to-r from-purple-500 to-pink-500',
        textColor: 'text-purple-600',
        borderColor: 'border-purple-200',
        bgColor: 'bg-purple-50',
        aspectRatio: 'aspect-square', // Square format
        isVideo: false,
        autoPlay: false
      };
    case 'facebook':
      return {
        icon: Facebook,
        label: 'Facebook',
        accent: 'bg-blue-700',
        textColor: 'text-blue-700',
        borderColor: 'border-blue-200',
        bgColor: 'bg-blue-50',
        aspectRatio: 'aspect-[4/3]',
        isVideo: false,
        autoPlay: false
      };
    default:
      return {
        icon: MessageCircle,
        label: 'Social Media',
        accent: 'bg-gray-600',
        textColor: 'text-gray-600',
        borderColor: 'border-gray-200',
        bgColor: 'bg-gray-50',
        aspectRatio: 'aspect-[4/3]',
        isVideo: false,
        autoPlay: false
      };
  }
};

// Helper function to detect if URL is a video
const isVideoUrl = (url: string): boolean => {
  const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.flv', '.wmv'];
  const videoDomains = ['youtube.com', 'youtu.be', 'vimeo.com'];
  
  return videoExtensions.some(ext => url.toLowerCase().includes(ext)) ||
         videoDomains.some(domain => url.toLowerCase().includes(domain));
};

// TikTok Carousel Component
const TikTokCarousel = ({ mediaUrls, topic, content, hashtags, brandName }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  
  const formattedHashtags = hashtags?.map(tag => 
    tag.startsWith('#') ? tag : `#${tag}`
  ).join(' ') || '';

  const nextMedia = () => {
    setCurrentIndex((prev) => (prev + 1) % mediaUrls.length);
  };

  const prevMedia = () => {
    setCurrentIndex((prev) => (prev - 1 + mediaUrls.length) % mediaUrls.length);
  };

  return (
    <div className="bg-black rounded-lg overflow-hidden shadow-lg max-w-[280px] mx-auto">
      <div className="relative aspect-[9/16] bg-black">
        {mediaUrls.length > 0 ? (
          <div className="relative w-full h-full">
            {/* Current Media */}
            <div className="absolute inset-0">
              {isVideoUrl(mediaUrls[currentIndex]) ? (
                <video
                  src={mediaUrls[currentIndex]}
                  className="w-full h-full object-cover"
                  autoPlay={true}
                  muted={isMuted}
                  loop={true}
                  playsInline
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
              ) : (
                <img
                  src={mediaUrls[currentIndex]}
                  alt="TikTok media"
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            
            {/* Navigation Arrows */}
            {mediaUrls.length > 1 && (
              <>
                <button
                  onClick={prevMedia}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors z-10"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={nextMedia}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors z-10"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}
            
            {/* Media Counter */}
            {mediaUrls.length > 1 && (
              <div className="absolute top-4 right-4 bg-black/50 text-white text-xs px-2 py-1 rounded z-10">
                {currentIndex + 1}/{mediaUrls.length}
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full bg-gray-800 flex items-center justify-center">
            <div className="text-center text-white">
              <Music className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-sm opacity-75">No media</p>
            </div>
          </div>
        )}
        
        {/* TikTok Overlay Controls */}
        <div className="absolute inset-0 flex flex-col justify-between p-2">
          {/* Top - Brand */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
              <span className="text-black font-bold text-xs">{brandName?.charAt(0) || 'B'}</span>
            </div>
            <span className="text-white font-semibold text-xs">{brandName}</span>
          </div>
          
          {/* Bottom - Content and Controls */}
          <div className="flex justify-between items-end">
            {/* Left - Content */}
            <div className="flex-1 pr-2">
              <p className="text-white text-xs font-medium mb-1">{topic}</p>
              <p className="text-white text-xs mb-1 line-clamp-2">{content}</p>
              {formattedHashtags && (
                <p className="text-white text-xs font-medium">{formattedHashtags}</p>
              )}
            </div>
            
            {/* Right - Engagement */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <Heart className="w-4 h-4 text-white" />
                </div>
                <span className="text-white text-xs">2.1K</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-white" />
                </div>
                <span className="text-white text-xs">156</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <Share2 className="w-4 h-4 text-white" />
                </div>
                <span className="text-white text-xs">89</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Play/Pause Overlay */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <button 
              onClick={() => setIsPlaying(true)}
              className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center"
            >
              <Play className="w-6 h-6 text-white ml-1" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Instagram Carousel Component
const InstagramCarousel = ({ mediaUrls, topic, content, hashtags, brandName }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const formattedHashtags = hashtags?.map(tag => 
    tag.startsWith('#') ? tag : `#${tag}`
  ).join(' ') || '';

  const nextMedia = () => {
    setCurrentIndex((prev) => (prev + 1) % mediaUrls.length);
  };

  const prevMedia = () => {
    setCurrentIndex((prev) => (prev - 1 + mediaUrls.length) % mediaUrls.length);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm max-w-[320px] mx-auto">
      {/* Instagram Header */}
      <div className="flex items-center gap-2 p-2 border-b border-gray-100">
        <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
          <span className="text-white font-bold text-xs">{brandName?.charAt(0) || 'B'}</span>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 text-xs">{brandName}</h3>
        </div>
        <div className="text-gray-400">
          <MoreHorizontal className="w-4 h-4" />
        </div>
      </div>
      
      {/* Instagram Media Carousel */}
      {mediaUrls.length > 0 ? (
        <div className="relative aspect-square bg-gray-100">
          {/* Current Media */}
          <div className="absolute inset-0">
            {isVideoUrl(mediaUrls[currentIndex]) ? (
              <video
                src={mediaUrls[currentIndex]}
                className="w-full h-full object-cover"
                controls
              />
            ) : (
              <img
                src={mediaUrls[currentIndex]}
                alt="Instagram post"
                className="w-full h-full object-cover"
              />
            )}
          </div>
          
          {/* Navigation Arrows */}
          {mediaUrls.length > 1 && (
            <>
              <button
                onClick={prevMedia}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={nextMedia}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
          
          {/* Dots Indicator */}
          {mediaUrls.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {mediaUrls.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentIndex ? 'bg-white' : 'bg-white/50'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="aspect-square bg-gray-100 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <Instagram className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-sm">No media</p>
          </div>
        </div>
      )}
      
      {/* Instagram Actions */}
      <div className="flex items-center gap-3 p-2">
        <Heart className="w-5 h-5 text-gray-900" />
        <MessageCircle className="w-5 h-5 text-gray-900" />
        <Share2 className="w-5 h-5 text-gray-900" />
        <div className="flex-1" />
        <Bookmark className="w-5 h-5 text-gray-900" />
      </div>
      
      {/* Instagram Content */}
      <div className="px-2 pb-2">
        <div className="flex items-start gap-2 mb-1">
          {/*<span className="font-semibold text-gray-900 text-xs">{brandName}</span>*/}
          <span className="text-gray-900 text-xs">{content}</span>
        </div>
        {formattedHashtags && (
          <p className="text-blue-600 text-xs">{formattedHashtags}</p>
        )}
        <p className="text-gray-500 text-xs mt-1">View all 156 comments</p>
      </div>
    </div>
  );
};

// LinkedIn Carousel Component
const LinkedInCarousel = ({ mediaUrls, topic, content, hashtags, brandName }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const formattedHashtags = hashtags?.map(tag => 
    tag.startsWith('#') ? tag : `#${tag}`
  ).join(' ') || '';

  const nextMedia = () => {
    setCurrentIndex((prev) => (prev + 1) % mediaUrls.length);
  };

  const prevMedia = () => {
    setCurrentIndex((prev) => (prev - 1 + mediaUrls.length) % mediaUrls.length);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm max-w-[350px] mx-auto">
      {/* LinkedIn Header */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-100">
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
          <span className="text-white font-bold text-sm">{brandName?.charAt(0) || 'B'}</span>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 text-sm">{brandName}</h3>
          <p className="text-xs text-gray-500">Company • LinkedIn</p>
        </div>
        <div className="text-xs text-gray-400">Now</div>
      </div>
      
      {/* LinkedIn Content */}
      <div className="p-3">
        {topic && (
          <h4 className="font-semibold text-gray-900 mb-1 text-sm">{topic}</h4>
        )}
        <p className="text-gray-800 mb-2 leading-relaxed text-sm">{content}</p>
        
        {/* LinkedIn Media Carousel */}
        {mediaUrls.length > 0 ? (
          <div className="relative mb-3">
            <div className="aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden">
              {/* Current Media */}
              <div className="absolute inset-0">
                {isVideoUrl(mediaUrls[currentIndex]) ? (
                  <video
                    src={mediaUrls[currentIndex]}
                    className="w-full h-full object-cover"
                    controls
                  />
                ) : (
                  <img
                    src={mediaUrls[currentIndex]}
                    alt="LinkedIn post media"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              
              {/* Navigation Arrows */}
              {mediaUrls.length > 1 && (
                <>
                  <button
                    onClick={prevMedia}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={nextMedia}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
              
              {/* Dots Indicator */}
              {mediaUrls.length > 1 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {mediaUrls.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentIndex(index)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        index === currentIndex ? 'bg-white' : 'bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
        
        {/* LinkedIn Hashtags */}
        {formattedHashtags && (
          <div className="mb-2">
            <p className="text-blue-600 text-xs">{formattedHashtags}</p>
          </div>
        )}
        
        {/* LinkedIn Engagement */}
        <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-100 pt-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Heart className="w-3 h-3" />
              1.2K
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="w-3 h-3" />
              97
            </span>
            <span className="flex items-center gap-1">
              <Share2 className="w-3 h-3" />
              39
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            6.6M
          </div>
        </div>
      </div>
    </div>
  );
};

// Twitter Carousel Component
const TwitterCarousel = ({ mediaUrls, topic, content, hashtags, brandName }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const formattedHashtags = hashtags?.map(tag => 
    tag.startsWith('#') ? tag : `#${tag}`
  ).join(' ') || '';

  const nextMedia = () => {
    setCurrentIndex((prev) => (prev + 1) % mediaUrls.length);
  };

  const prevMedia = () => {
    setCurrentIndex((prev) => (prev - 1 + mediaUrls.length) % mediaUrls.length);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm max-w-[350px] mx-auto">
      {/* Twitter Header */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-100">
        <div className="w-8 h-8 bg-sky-500 rounded-full flex items-center justify-center">
          <span className="text-white font-bold text-sm">{brandName?.charAt(0) || 'B'}</span>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 text-sm">{brandName}</h3>
          <p className="text-xs text-gray-500">@{brandName?.toLowerCase().replace(/\s+/g, '') || 'brand'}</p>
        </div>
        <div className="text-xs text-gray-400">Now</div>
      </div>
      
      {/* Twitter Content */}
      <div className="p-3">
        <p className="text-gray-800 mb-2 leading-relaxed text-sm">{content}</p>
        
        {/* Twitter Media Carousel */}
        {mediaUrls.length > 0 ? (
          <div className="relative mb-3">
            <div className="aspect-[16/9] bg-gray-100 rounded-lg overflow-hidden">
              {/* Current Media */}
              <div className="absolute inset-0">
                {isVideoUrl(mediaUrls[currentIndex]) ? (
                  <video
                    src={mediaUrls[currentIndex]}
                    className="w-full h-full object-cover"
                    controls
                  />
                ) : (
                  <img
                    src={mediaUrls[currentIndex]}
                    alt="Twitter post media"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              
              {/* Navigation Arrows */}
              {mediaUrls.length > 1 && (
                <>
                  <button
                    onClick={prevMedia}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={nextMedia}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
              
              {/* Dots Indicator */}
              {mediaUrls.length > 1 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {mediaUrls.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentIndex(index)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        index === currentIndex ? 'bg-white' : 'bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
        
        {/* Twitter Hashtags */}
        {formattedHashtags && (
          <div className="mb-2">
            <p className="text-blue-600 text-xs">{formattedHashtags}</p>
          </div>
        )}
        
        {/* Twitter Engagement */}
        <div className="flex items-center gap-4 text-xs text-gray-500 border-t border-gray-100 pt-2">
          <span className="flex items-center gap-1">
            <MessageCircle className="w-3 h-3" />
            43
          </span>
          <span className="flex items-center gap-1">
            <Repeat2 className="w-3 h-3" />
            156
          </span>
          <span className="flex items-center gap-1">
            <Heart className="w-3 h-3" />
            2.1K
          </span>
          <span className="flex items-center gap-1">
            <Share2 className="w-3 h-3" />
            Share
          </span>
        </div>
      </div>
    </div>
  );
};

// Facebook Carousel Component
const FacebookCarousel = ({ mediaUrls, topic, content, hashtags, brandName }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const formattedHashtags = hashtags?.map(tag => 
    tag.startsWith('#') ? tag : `#${tag}`
  ).join(' ') || '';

  const nextMedia = () => {
    setCurrentIndex((prev) => (prev + 1) % mediaUrls.length);
  };

  const prevMedia = () => {
    setCurrentIndex((prev) => (prev - 1 + mediaUrls.length) % mediaUrls.length);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm max-w-[350px] mx-auto">
      {/* Facebook Header */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-100">
        <div className="w-8 h-8 bg-blue-700 rounded-full flex items-center justify-center">
          <span className="text-white font-bold text-sm">{brandName?.charAt(0) || 'B'}</span>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 text-sm">{brandName}</h3>
          <p className="text-xs text-gray-500">Facebook</p>
        </div>
        <div className="text-xs text-gray-400">Now</div>
      </div>
      
      {/* Facebook Content */}
      <div className="p-3">
        <p className="text-gray-800 mb-2 leading-relaxed text-sm">{content}</p>
        
        {/* Facebook Media Carousel */}
        {mediaUrls.length > 0 ? (
          <div className="relative mb-3">
            <div className="aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden">
              {/* Current Media */}
              <div className="absolute inset-0">
                {isVideoUrl(mediaUrls[currentIndex]) ? (
                  <video
                    src={mediaUrls[currentIndex]}
                    className="w-full h-full object-cover"
                    controls
                  />
                ) : (
                  <img
                    src={mediaUrls[currentIndex]}
                    alt="Facebook post media"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              
              {/* Navigation Arrows */}
              {mediaUrls.length > 1 && (
                <>
                  <button
                    onClick={prevMedia}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={nextMedia}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
              
              {/* Dots Indicator */}
              {mediaUrls.length > 1 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {mediaUrls.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentIndex(index)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        index === currentIndex ? 'bg-white' : 'bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
        
        {/* Facebook Hashtags */}
        {formattedHashtags && (
          <div className="mb-2">
            <p className="text-blue-600 text-xs">{formattedHashtags}</p>
          </div>
        )}
        
        {/* Facebook Engagement */}
        <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-100 pt-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <ThumbsUp className="w-3 h-3" />
              1.8K
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="w-3 h-3" />
              123
            </span>
            <span className="flex items-center gap-1">
              <Share2 className="w-3 h-3" />
              67
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            15.2M
          </div>
        </div>
      </div>
    </div>
  );
};

// YouTube Carousel Component
const YouTubeCarousel = ({ mediaUrls, topic, content, hashtags, brandName }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const formattedHashtags = hashtags?.map(tag => 
    tag.startsWith('#') ? tag : `#${tag}`
  ).join(' ') || '';

  const nextMedia = () => {
    setCurrentIndex((prev) => (prev + 1) % mediaUrls.length);
  };

  const prevMedia = () => {
    setCurrentIndex((prev) => (prev - 1 + mediaUrls.length) % mediaUrls.length);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm max-w-[350px] mx-auto">
      {/* YouTube Video Carousel */}
      {mediaUrls.length > 0 ? (
        <div className="relative aspect-video bg-black">
          {/* Current Media */}
          <div className="absolute inset-0">
            {isVideoUrl(mediaUrls[currentIndex]) ? (
              <video
                src={mediaUrls[currentIndex]}
                className="w-full h-full object-cover"
                controls={false}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
            ) : (
              <img
                src={mediaUrls[currentIndex]}
                alt="YouTube media"
                className="w-full h-full object-cover"
              />
            )}
          </div>
          
          {/* Navigation Arrows */}
          {mediaUrls.length > 1 && (
            <>
              <button
                onClick={prevMedia}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={nextMedia}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
          
          {/* Dots Indicator */}
          {mediaUrls.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {mediaUrls.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentIndex ? 'bg-white' : 'bg-white/50'
                  }`}
                />
              ))}
            </div>
          )}
          
          {/* YouTube Play Button Overlay */}
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <button 
            onClick={() => setIsPlaying(true)}
            className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700 transition-colors"
          >
            <Play className="w-6 h-6 text-white ml-1" />
          </button>
            </div>
          )}
        </div>
      ) : (
        <div className="aspect-video bg-gray-800 flex items-center justify-center">
          <div className="text-center text-white">
            <Youtube className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-sm opacity-75">No video</p>
          </div>
        </div>
      )}
      
      {/* YouTube Content */}
      <div className="p-3">
        {topic && (
          <h4 className="font-semibold text-gray-900 mb-1 text-sm">{topic}</h4>
        )}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-xs">{brandName?.charAt(0) || 'B'}</span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-xs">{brandName}</h3>
            <p className="text-xs text-gray-500">1.2K subscribers</p>
          </div>
        </div>
        <p className="text-gray-800 mb-2 leading-relaxed text-sm">{content}</p>
        
        {/* YouTube Hashtags */}
        {formattedHashtags && (
          <div className="mb-3">
            <p className="text-blue-600 text-sm">{formattedHashtags}</p>
          </div>
        )}
        
        {/* YouTube Engagement */}
        <div className="flex items-center gap-3 text-xs text-gray-500 border-t border-gray-100 pt-2">
          <span className="flex items-center gap-1">
            <ThumbsUp className="w-3 h-3" />
            4.2K
          </span>
          <span className="flex items-center gap-1">
            <ThumbsDown className="w-3 h-3" />
            23
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="w-3 h-3" />
            456
          </span>
          <span className="flex items-center gap-1">
            <Share2 className="w-3 h-3" />
            234
          </span>
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            45.6M
          </span>
        </div>
      </div>
    </div>
  );
};

// Main PlatformPreview component
export const PlatformPreview: React.FC<PlatformPreviewProps> = ({
  platform,
  topic,
  content,
  mediaUrls = [], // Changed to array for carousel support
  hashtags = [],
  scheduledAt,
  brandName = 'Your Brand'
}) => {
  const platformMeta = getPlatformMeta(platform);
  const normalizedPlatform = platform.toLowerCase();

  const renderPlatformSpecificPreview = () => {
    switch (normalizedPlatform) {
      case 'tiktok':
        return (
          <TikTokCarousel
            mediaUrls={mediaUrls}
            topic={topic}
            content={content}
            hashtags={hashtags}
            brandName={brandName}
          />
        );
      case 'instagram':
        return (
          <InstagramCarousel
            mediaUrls={mediaUrls}
            topic={topic}
            content={content}
            hashtags={hashtags}
            brandName={brandName}
          />
        );
      case 'linkedin':
        return (
          <LinkedInCarousel
            mediaUrls={mediaUrls}
            topic={topic}
            content={content}
            hashtags={hashtags}
            brandName={brandName}
          />
        );
      case 'twitter':
        return (
          <TwitterCarousel
            mediaUrls={mediaUrls}
            topic={topic}
            content={content}
            hashtags={hashtags}
            brandName={brandName}
          />
        );
      case 'facebook':
        return (
          <FacebookCarousel
            mediaUrls={mediaUrls}
            topic={topic}
            content={content}
            hashtags={hashtags}
            brandName={brandName}
          />
        );
      case 'youtube':
        return (
          <YouTubeCarousel
            mediaUrls={mediaUrls}
            topic={topic}
            content={content}
            hashtags={hashtags}
            brandName={brandName}
          />
        );
      default:
        return (
          <LinkedInCarousel
            mediaUrls={mediaUrls}
            topic={topic}
            content={content}
            hashtags={hashtags}
            brandName={brandName}
          />
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white ${platformMeta.accent}`}>
          <platformMeta.icon className="w-3 h-3" />
        </div>
        <h3 className="font-semibold text-white-900">Live Preview</h3>
        <Badge variant="outline" className={platformMeta.textColor}>
          {platformMeta.label}
        </Badge>
      </div>
      
      {renderPlatformSpecificPreview()}
    </div>
  );
};