import React from "react";
import { QRCodeCanvas } from "qrcode.react";

interface QRCodeLinkProps {
  sessionId: string;
}

const QRCodeLink: React.FC<QRCodeLinkProps> = ({ sessionId }) => {
  const listenerUrl = `${window.location.origin}/listen/${sessionId}`;

  return (
    <div className="qr-code-container">
      <p>Scan the QR code to join the session:</p>
      <QRCodeCanvas value={listenerUrl} size={150} />
      <p>Or use this link:</p>
      <a href={listenerUrl} target="_blank" rel="noopener noreferrer">
        {listenerUrl}
      </a>
    </div>
  );
};

export default QRCodeLink;
