import React from 'react';

interface Program {
  id          : number;
  name        : string;
  time        : string;
  description : string;
}

interface TVGuideProps {
  channel   : number;
  programs  : Program[];
  onClose   : () => void;
}

const TVGuide: React.FC<TVGuideProps> = ({ channel, programs, onClose }) => {
  return (
    <div className="tv-guide">
      <div className="guide-header">
        <h2>TV GUIDE - Channel {channel}</h2>
        <button 
          className="close-button" 
          onClick={onClose}
        >
          X
        </button>
      </div>

      <div className="guide-content">
        {programs.length === 0 ? (
          <p className="no-programs">
            No program information available
          </p>
        ) : (
          <div className="program-list">
            {programs.map((program) => (
              <div 
                key={program.id} 
                className="program-item"
              >
                <span className="program-time">
                  {program.time}
                </span>
                <span className="program-name">
                  {program.name}
                </span>
                <p className="program-description">
                  {program.description}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TVGuide;
