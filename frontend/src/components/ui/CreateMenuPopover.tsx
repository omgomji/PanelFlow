'use client';

type CreateMenuPopoverProps = {
  onCreateEventType: () => void;
  onCreateSingleUseLink: () => void;
  onCreateMeetingPoll: () => void;
};

type MenuItem = {
  title: string;
  subtitle: string;
  description: string;
  action: 'event-type' | 'single-use' | 'meeting-poll';
};

const menuItems: MenuItem[] = [
  {
    title: 'Event type',
    subtitle: '',
    description: 'Create a new meeting template',
    action: 'event-type',
  },
  {
    title: 'One-off meeting',
    subtitle: '',
    description: 'Offer time outside your normal schedule',
    action: 'single-use',
  },
  {
    title: 'Meeting poll',
    subtitle: '',
    description: 'Let invitees vote on a time to meet',
    action: 'meeting-poll',
  },
];

function ItemRow({ item, onSelect }: { item: MenuItem; onSelect: (action: MenuItem['action']) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.action)}
      className="w-full rounded-sm px-2 py-1.5 text-left hover:bg-clay/5"
    >
      <div className="text-[14px] font-display font-semibold tracking-wide font-bold text-stamp">{item.title}</div>
      <div className="text-[12px] font-medium font-medium text-ink/60">{item.description}</div>
    </button>
  );
}

export default function CreateMenuPopover({
  onCreateEventType,
  onCreateSingleUseLink,
  onCreateMeetingPoll,
}: CreateMenuPopoverProps) {
  const handleSelect = (action: MenuItem['action']) => {
    if (action === 'event-type') {
      onCreateEventType();
      return;
    }
    if (action === 'single-use') {
      onCreateSingleUseLink();
      return;
    }
    onCreateMeetingPoll();
  };

  return (
    <div className="relative z-50 w-[min(92vw,320px)] rounded-sm border-2 border-ink bg-paper p-2 shadow-[0_8px_24px_rgba(16,42,67,0.14)]">
      <div className="space-y-1">
        {menuItems.map((item) => (
          <ItemRow key={item.title} item={item} onSelect={handleSelect} />
        ))}
      </div>
    </div>
  );
}
