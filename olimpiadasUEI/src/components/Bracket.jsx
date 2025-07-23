import React from 'react';
import '../styles/Bracket.css';

const Bracket = ({ octavos, cuartos, semifinales, final, tercerLugar }) => {
  return (
    <div className="bracket-container">
      {/* Octavos de Final */}
      {octavos && octavos.length > 0 && (
        <div className="bracket-round">
          <h4 className="round-title">Octavos de Final</h4>
          <div className="matches-column">
            {octavos.map((match, index) => (
              <div key={index} className="bracket-match">
                <div className="match-info">
                  {typeof match === 'string' ? (
                    <span className="team-placeholder">{match}</span>
                  ) : (
                    <>
                      <div className="bracket-team">
                        <span className="team-name">
                          {match.equipoA ? `${match.equipoA.curso} ${match.equipoA.paralelo}` : 'TBD'}
                        </span>
                        <span className="team-score">
                          {match.marcadorA !== null ? match.marcadorA : '-'}
                        </span>
                      </div>
                      <div className="vs-separator">VS</div>
                      <div className="bracket-team">
                        <span className="team-name">
                          {match.equipoB ? `${match.equipoB.curso} ${match.equipoB.paralelo}` : 'TBD'}
                        </span>
                        <span className="team-score">
                          {match.marcadorB !== null ? match.marcadorB : '-'}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cuartos de Final */}
      {cuartos && cuartos.length > 0 && (
        <div className="bracket-round">
          <h4 className="round-title">Cuartos de Final</h4>
          <div className="matches-column">
            {cuartos.map((match, index) => (
              <div key={index} className="bracket-match">
                <div className="match-info">
                  {typeof match === 'string' ? (
                    <span className="team-placeholder">{match}</span>
                  ) : (
                    <>
                      <div className="bracket-team">
                        <span className="team-name">
                          {match.equipoA ? `${match.equipoA.curso} ${match.equipoA.paralelo}` : 'TBD'}
                        </span>
                        <span className="team-score">
                          {match.marcadorA !== null ? match.marcadorA : '-'}
                        </span>
                      </div>
                      <div className="vs-separator">VS</div>
                      <div className="bracket-team">
                        <span className="team-name">
                          {match.equipoB ? `${match.equipoB.curso} ${match.equipoB.paralelo}` : 'TBD'}
                        </span>
                        <span className="team-score">
                          {match.marcadorB !== null ? match.marcadorB : '-'}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Semifinales */}
      {semifinales && semifinales.length > 0 && (
        <div className="bracket-round">
          <h4 className="round-title">Semifinales</h4>
          <div className="matches-column">
            {semifinales.map((match, index) => (
              <div key={index} className="bracket-match">
                <div className="match-info">
                  {typeof match === 'string' ? (
                    <span className="team-placeholder">{match}</span>
                  ) : (
                    <>
                      <div className="bracket-team">
                        <span className="team-name">
                          {match.equipoA ? `${match.equipoA.curso} ${match.equipoA.paralelo}` : 'TBD'}
                        </span>
                        <span className="team-score">
                          {match.marcadorA !== null ? match.marcadorA : '-'}
                        </span>
                      </div>
                      <div className="vs-separator">VS</div>
                      <div className="bracket-team">
                        <span className="team-name">
                          {match.equipoB ? `${match.equipoB.curso} ${match.equipoB.paralelo}` : 'TBD'}
                        </span>
                        <span className="team-score">
                          {match.marcadorB !== null ? match.marcadorB : '-'}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Final */}
      {final && final.length > 0 && (
        <div className="bracket-round final-round">
          <h4 className="round-title">Final</h4>
          <div className="matches-column">
            {final.map((match, index) => (
              <div key={index} className="bracket-match final-match">
                <div className="match-info">
                  {typeof match === 'string' ? (
                    <span className="team-placeholder">{match}</span>
                  ) : (
                    <>
                      <div className="bracket-team">
                        <span className="team-name">
                          {match.equipoA ? `${match.equipoA.curso} ${match.equipoA.paralelo}` : 'TBD'}
                        </span>
                        <span className="team-score">
                          {match.marcadorA !== null ? match.marcadorA : '-'}
                        </span>
                      </div>
                      <div className="vs-separator">VS</div>
                      <div className="bracket-team">
                        <span className="team-name">
                          {match.equipoB ? `${match.equipoB.curso} ${match.equipoB.paralelo}` : 'TBD'}
                        </span>
                        <span className="team-score">
                          {match.marcadorB !== null ? match.marcadorB : '-'}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tercer Lugar */}
      {tercerLugar && (
        <div className="bracket-round third-place-round">
          <h4 className="round-title">Tercer Lugar</h4>
          <div className="matches-column">
            <div className="bracket-match third-place-match">
              <div className="match-info">
                {typeof tercerLugar === 'string' ? (
                  <span className="team-placeholder">{tercerLugar}</span>
                ) : (
                  <>
                    <div className="bracket-team">
                      <span className="team-name">
                        {tercerLugar.equipoA ? `${tercerLugar.equipoA.curso} ${tercerLugar.equipoA.paralelo}` : 'TBD'}
                      </span>
                      <span className="team-score">
                        {tercerLugar.marcadorA !== null ? tercerLugar.marcadorA : '-'}
                      </span>
                    </div>
                    <div className="vs-separator">VS</div>
                    <div className="bracket-team">
                      <span className="team-name">
                        {tercerLugar.equipoB ? `${tercerLugar.equipoB.curso} ${tercerLugar.equipoB.paralelo}` : 'TBD'}
                      </span>
                      <span className="team-score">
                        {tercerLugar.marcadorB !== null ? tercerLugar.marcadorB : '-'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Bracket;
