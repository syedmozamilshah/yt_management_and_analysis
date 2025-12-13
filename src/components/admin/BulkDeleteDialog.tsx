
import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

interface BulkDeleteDialogProps {
  selectedCount: number;
  onBulkDelete: () => void;
  isDeleting: boolean;
}

const BulkDeleteDialog = ({ selectedCount, onBulkDelete, isDeleting }: BulkDeleteDialogProps) => {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="destructive"
          size="sm"
          disabled={isDeleting}
          className="bg-[#cc0000] hover:bg-[#aa0000]"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Selected ({selectedCount})
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-[#181818] border-[#272727]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white">Delete Multiple Videos</AlertDialogTitle>
          <AlertDialogDescription className="text-[#aaaaaa]">
            Are you sure you want to delete {selectedCount} selected video{selectedCount > 1 ? 's' : ''}? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-[#212121] border-[#272727] text-[#aaaaaa] hover:bg-[#272727]">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onBulkDelete}
            className="bg-[#cc0000] text-white hover:bg-[#aa0000]"
          >
            {isDeleting ? 'Deleting...' : `Delete ${selectedCount} Video${selectedCount > 1 ? 's' : ''}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default BulkDeleteDialog;
