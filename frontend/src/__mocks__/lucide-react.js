// Mock for lucide-react icons
const createMockIcon = (name) => {
  const MockIcon = ({ size = 24, color = 'currentColor', strokeWidth = 2, className, ...props }) => (
    <svg
      data-testid={`icon-${name}`}
      data-icon-name={name}
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      className={className}
      {...props}
    >
      <title>{name}</title>
    </svg>
  );
  MockIcon.displayName = `Mock${name}`;
  return MockIcon;
};

// Export all commonly used icons
export const Plus = createMockIcon('Plus');
export const X = createMockIcon('X');
export const ChevronLeft = createMockIcon('ChevronLeft');
export const ChevronRight = createMockIcon('ChevronRight');
export const Pause = createMockIcon('Pause');
export const Play = createMockIcon('Play');
export const MessageSquare = createMockIcon('MessageSquare');
export const Heart = createMockIcon('Heart');
export const MoreVertical = createMockIcon('MoreVertical');
export const Eye = createMockIcon('Eye');
export const Users = createMockIcon('Users');
export const Flag = createMockIcon('Flag');
export const Delete = createMockIcon('Delete');
export const Copy = createMockIcon('Copy');
export const Image = createMockIcon('Image');
export const Paperclip = createMockIcon('Paperclip');
export const Smile = createMockIcon('Smile');
export const Video = createMockIcon('Video');
export const Send = createMockIcon('Send');
export const AtSign = createMockIcon('AtSign');
export const MoreHorizontal = createMockIcon('MoreHorizontal');
export const PenTool = createMockIcon('PenTool');
export const Crop = createMockIcon('Crop');
export const Lock = createMockIcon('Lock');
export const UserMinus = createMockIcon('UserMinus');
export const UserPlus = createMockIcon('UserPlus');

// Default export for any other icons
const icons = {
  Plus, X, ChevronLeft, ChevronRight, Pause, Play, MessageSquare, Heart,
  MoreVertical, Eye, Users, Flag, Delete, Copy, Image, Paperclip, Smile,
  Video, Send, AtSign, MoreHorizontal, PenTool, Crop, Lock, UserMinus, UserPlus,
};

export default icons;