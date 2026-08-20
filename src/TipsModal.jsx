export default function TipsModal({ onClose }) {
  return (
    <div className="editor-overlay" onClick={onClose}>
      <div className="tips-modal" onClick={(e) => e.stopPropagation()}>
        <h2>App Guide 📸</h2>

        <div className="tips-section">
          <h3>Gestures</h3>
          <ul>
            <li>
              <strong>Tap Image:</strong> Flip to backside
            </li>
            <li>
              <strong>Long Press (0.5s):</strong> Edit image
            </li>
          </ul>
        </div>

        <div className="tips-section">
          <h3>Organization</h3>
          <ul>
            <li>
              <strong>Folders:</strong> Drag images onto a folder in the sidebar
              to organize.
            </li>
            <li>
              <strong>Multi-Select:</strong> Use "Select All" in the menu to
              move or export in bulk.
            </li>
            <li>
              <strong>Trash:</strong> Drag items to the red zone to delete them.
            </li>
          </ul>
        </div>

        <button className="done-btn" onClick={onClose}>
          Got it!
        </button>
      </div>
    </div>
  );
}
