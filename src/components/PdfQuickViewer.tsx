import React, { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';

type PdfQuickViewerProps = {
  pdfId?: string;
};

const PdfQuickViewer: React.FC<PdfQuickViewerProps> = ({ pdfId }) => {
  const pdfDoc = useAppStore((state) => state.pdfs.find((pdf) => pdf.id === pdfId));
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const frameSrc = useMemo(() => {
    if (!pdfUrl) return null;
    return `${pdfUrl}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`;
  }, [pdfUrl]);

  useEffect(() => {
    if (!pdfDoc?.data || typeof window === 'undefined') {
      setPdfUrl(null);
      return;
    }

    const url = window.URL.createObjectURL(new Blob([pdfDoc.data], { type: 'application/pdf' }));
    setPdfUrl(url);

    return () => {
      window.URL.revokeObjectURL(url);
    };
  }, [pdfDoc?.id, pdfDoc?.data]);

  if (!pdfId) {
    return (
      <div className="pdf-native-viewer flex-1 flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>No PDF selected.</p>
      </div>
    );
  }

  if (!pdfDoc) {
    return (
      <div className="pdf-native-viewer flex-1 flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading PDF document...</p>
      </div>
    );
  }

  return (
    <div
      className="pdf-native-viewer flex-1 relative"
      style={{
        background: '#cfd3da',
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch',
        touchAction: 'auto',
      }}
    >
      {frameSrc ? (
        <object
          key={frameSrc}
          data={frameSrc}
          type="application/pdf"
          className="w-full h-full"
          style={{ background: '#cfd3da', touchAction: 'auto' }}
        >
          <iframe
            src={frameSrc}
            title={pdfDoc.title || 'PDF Viewer'}
            className="w-full h-full border-0"
            style={{ background: '#cfd3da', touchAction: 'auto', pointerEvents: 'auto' }}
            allow="fullscreen"
          />
        </object>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <p style={{ color: 'var(--color-text-secondary)' }}>Preparing PDF viewer...</p>
        </div>
      )}

      {pdfUrl && (
        <a
          href={pdfUrl}
          target="_blank"
          rel="noreferrer"
          className="absolute right-3 bottom-3 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ background: 'rgba(0,0,0,0.65)', color: '#fff' }}
        >
          Open in new tab
        </a>
      )}
    </div>
  );
};

export default PdfQuickViewer;
