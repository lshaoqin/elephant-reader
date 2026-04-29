import React, { ReactNode, useState, useEffect } from 'react';
import { QuestionMarkCircledIcon, Cross2Icon } from '@radix-ui/react-icons';
import { createPortal } from 'react-dom';

interface HelpPopoverProps {
  children?: ReactNode;
}

export const HelpPopover: React.FC<HelpPopoverProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);

  // Allow attaching onClick to string or element children
  const trigger = children ? (
    React.isValidElement(children) ? (
      React.cloneElement(children as React.ReactElement<any>, { onClick: openModal })
    ) : (
      <span onClick={openModal}>{children}</span>
    )
  ) : (
    <button
      onClick={openModal}
      className="text-gray-600 dark:text-gray-400 hover:text-blue-500 transition-colors"
      aria-label="Help"
    >
      <QuestionMarkCircledIcon className="w-7 h-7" />
    </button>
  );

  return (
    <>
      {trigger}
      {mounted && isOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 md:p-8">
          {/* Modal Container optimized for tablet/desktop */}
          <div className="w-full max-w-4xl h-[90vh] md:h-[85vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-slate-700 flex flex-col relative animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex justify-between items-center p-4 md:p-5 border-b bg-gray-50 dark:bg-slate-800 dark:border-slate-700">
              <h3 className="font-bold text-lg md:text-xl text-gray-800 dark:text-gray-200">
                How to use Elephant Reader
              </h3>
              <button
                onClick={closeModal}
                className="p-2 -mr-2 bg-gray-200/50 hover:bg-gray-200 dark:bg-slate-700/50 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400 rounded-full transition-colors"
                aria-label="Close"
              >
                <Cross2Icon className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>
            
            {/* PDF Viewer */}
            <div className="flex-1 w-full bg-gray-100 dark:bg-slate-950">
              <iframe
                src="/Guide to Elephant Reader.pdf#view=FitH"
                className="w-full h-full border-0"
                title="Help PDF Guide"
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
