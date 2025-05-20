'use client';

import { Button } from '@/components/ui/button';
import type { SuggestedQuestion } from '@/lib/types';

type SuggestedRepliesProps = {
  replies: SuggestedQuestion[];
  onReplyClick: (reply: SuggestedQuestion) => void;
  isLoading?: boolean;
};

export function SuggestedReplies({ replies, onReplyClick, isLoading }: SuggestedRepliesProps) {
  if (!replies || replies.length === 0) {
    return null;
  }

  return (
    <div className="p-2 flex flex-wrap gap-2 justify-center border-t">
      {replies.map((reply, index) => (
        <Button
          key={index}
          variant="outline"
          size="sm"
          onClick={() => onReplyClick(reply)}
          disabled={isLoading}
          className="bg-background hover:bg-muted"
        >
          {reply.question}
        </Button>
      ))}
    </div>
  );
}
