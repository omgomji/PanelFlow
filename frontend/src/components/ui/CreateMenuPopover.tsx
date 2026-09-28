'use client';

type CreateMenuPopoverProps = {
  onCreateEventType: () => void;
};

type MenuItem = {
  title: string;
  subtitle: string;
  description: string;
  action: 'event-type';
};

const menuItems: MenuItem[] = [
  {
    title: 'Event type',
    subtitle: '',
    description: 'Create a new meeting template',
    action: 'event-type',
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

export default function CreateMenuPopover({ onCreateEventType }: CreateMenuPopoverProps) {
  const handleSelect = (action: MenuItem['action']) => {
    if (action === 'event-type') {
      onCreateEventType();
      return;
    }
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
