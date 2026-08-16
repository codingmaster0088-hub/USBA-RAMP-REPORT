import React, { useEffect, useRef } from 'react';
import { captureHtml2CanvasSafe } from '../utils/html2canvasHelper';
import { RampReportFormData, ReportType, FlightMode, UserProfile } from '../types';

interface ReportCanvasCardProps {
  formData: RampReportFormData;
  type: ReportType;
  mode: FlightMode;
  user: UserProfile;
  onCaptureComplete: (dataUrl: string) => void;
  onCaptureError: (err: any) => void;
}

const formatTimeLT = (val?: string) => {
  if (!val || !val.trim()) return '';
  const trimmed = val.trim();
  if (
    trimmed === 'OB' ||
    trimmed === 'EARLIER' ||
    trimmed === 'N/A' ||
    trimmed === 'ON GROUND' ||
    trimmed.endsWith('LT') ||
    trimmed.endsWith('(LT)')
  ) {
    return trimmed;
  }
  return `${trimmed} LT`;
};

const formatBagCount = (val?: string) => {
  if (!val || !val.trim()) return null;
  const num = parseInt(val.trim(), 10);
  if (isNaN(num)) return null;
  const padNum = num < 10 ? `0${num}` : `${num}`;
  const unit = num === 1 ? 'PC' : 'PCS';
  return `${padNum} ${unit}`;
};

export const ReportCanvasCard: React.FC<ReportCanvasCardProps> = ({
  formData,
  type,
  mode,
  user,
  onCaptureComplete,
  onCaptureError
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const timer = setTimeout(() => {
      if (!containerRef.current) return;
      captureHtml2CanvasSafe(containerRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      })
        .then((canvas) => {
          const imgData = canvas.toDataURL('image/jpeg', 0.92);
          onCaptureComplete(imgData);
        })
        .catch((err) => {
          onCaptureError(err);
        });
    }, 600);

    return () => clearTimeout(timer);
  }, [formData, type, mode, user]);

  const flightTitle = `BS-${formData.deptFlt || 'XXX'} (${formData.deptRoute || 'ROUTE'})`;
  const isDelay = formData.status?.includes('DELAY');
  const isEarly = formData.status?.includes('EARLY');

  const statusBg = isDelay ? '#dc3545' : isEarly ? '#28a745' : '#eca400';

  return (
    <div
      style={{
        position: 'fixed',
        top: '-9999px',
        left: '-9999px',
        width: '1280px',
        background: '#ffffff',
        color: '#000000',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      <div
        ref={containerRef}
        style={{
          width: '1280px',
          border: '6px solid #003366',
          boxSizing: 'border-box'
        }}
      >
        {/* Header */}
        <div
          style={{
            background: '#003366',
            color: '#ffffff',
            padding: '25px 20px',
            textAlign: 'center',
            borderBottom: '6px solid #eca400'
          }}
        >
          <div
            className="export-canvas-title"
            style={{
              margin: 0,
              fontSize: '55px',
              fontWeight: 900,
              letterSpacing: '2px',
              color: '#ffffff'
            }}
          >
            {flightTitle}
          </div>
          <div
            className="export-canvas-subtitle"
            style={{
              margin: '8px 0 0',
              fontSize: '30px',
              fontWeight: 800,
              color: '#eca400',
              textTransform: 'uppercase'
            }}
          >
            RAMP DEPARTURE REPORT
          </div>
        </div>

        {/* General Info */}
        <div
          style={{
            background: '#003366',
            color: '#ffffff',
            padding: '10px 30px',
            fontSize: '28px',
            fontWeight: 900,
            borderTop: '3px solid #000000',
            borderBottom: '3px solid #000000',
            textTransform: 'uppercase'
          }}
        >
          GENERAL INFORMATION
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '20px',
            padding: '12px 30px'
          }}
        >
          <div style={{ padding: '6px 0', borderBottom: '2px solid #ccc' }}>
            <span style={{ display: 'block', fontSize: '20px', color: '#003366', fontWeight: 900, marginBottom: '4px' }}>
              DATE
            </span>
            <span style={{ fontSize: '32px', fontWeight: 800, color: '#000000' }}>
              {formData.date || ''}
            </span>
          </div>

          <div style={{ padding: '6px 0', borderBottom: '2px solid #ccc' }}>
            <span style={{ display: 'block', fontSize: '20px', color: '#003366', fontWeight: 900, marginBottom: '4px' }}>
              A/C REG
            </span>
            <span style={{ fontSize: '32px', fontWeight: 800, color: '#000000' }}>
              {formData.ac || ''}
            </span>
          </div>

          <div style={{ padding: '6px 0', borderBottom: '2px solid #ccc' }}>
            <span style={{ display: 'block', fontSize: '20px', color: '#003366', fontWeight: 900, marginBottom: '4px' }}>
              {type === 'INTERNATIONAL' ? 'GATE NO' : 'BAY NO'}
            </span>
            <span style={{ fontSize: '32px', fontWeight: 800, color: '#000000' }}>
              {formData.bay || ''}
            </span>
          </div>

          {type === 'INTERNATIONAL' && (
            <>
              <div style={{ padding: '6px 0', borderBottom: '2px solid #ccc' }}>
                <span style={{ display: 'block', fontSize: '20px', color: '#003366', fontWeight: 900, marginBottom: '4px' }}>
                  DOC IN
                </span>
                <span style={{ fontSize: '32px', fontWeight: 800, color: '#000000' }}>
                  {formData.docin ? `${formData.docin} (LT)` : ''}
                </span>
              </div>

              <div style={{ padding: '6px 0', borderBottom: '2px solid #ccc' }}>
                <span style={{ display: 'block', fontSize: '20px', color: '#003366', fontWeight: 900, marginBottom: '4px' }}>
                  DOC OUT
                </span>
                <span style={{ fontSize: '32px', fontWeight: 800, color: '#000000' }}>
                  {formData.docout ? `${formData.docout} (LT)` : ''}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Arrival Section if ROUND */}
        {mode === 'ROUND' && (
          <>
            <div
              style={{
                background: '#e0f7fa',
                color: '#003366',
                padding: '10px 30px',
                fontSize: '28px',
                fontWeight: 900,
                borderTop: '3px solid #000000',
                borderBottom: '3px solid #000000',
                textTransform: 'uppercase'
              }}
            >
              ARRIVAL INFORMATION
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '20px',
                padding: '12px 30px'
              }}
            >
              <div style={{ padding: '6px 0', borderBottom: '2px solid #ccc' }}>
                <span style={{ display: 'block', fontSize: '20px', color: '#003366', fontWeight: 900, marginBottom: '4px' }}>
                  FLIGHT
                </span>
                <span style={{ fontSize: '32px', fontWeight: 800, color: '#000000' }}>
                  {formData.arvFlt ? `BS-${formData.arvFlt}` : ''}
                </span>
              </div>

              <div style={{ padding: '6px 0', borderBottom: '2px solid #ccc' }}>
                <span style={{ display: 'block', fontSize: '20px', color: '#003366', fontWeight: 900, marginBottom: '4px' }}>
                  ROUTE
                </span>
                <span style={{ fontSize: '32px', fontWeight: 800, color: '#000000' }}>
                  {formData.arvRoute || ''}
                </span>
              </div>

              <div style={{ padding: '6px 0', borderBottom: '2px solid #ccc' }}>
                <span style={{ display: 'block', fontSize: '20px', color: '#003366', fontWeight: 900, marginBottom: '4px' }}>
                  C/ON
                </span>
                <span style={{ fontSize: '32px', fontWeight: 800, color: '#000000' }}>
                  {formData.con ? `${formData.con} (LT)` : ''}
                </span>
              </div>

              <div style={{ padding: '6px 0', borderBottom: '2px solid #ccc' }}>
                <span style={{ display: 'block', fontSize: '20px', color: '#003366', fontWeight: 900, marginBottom: '4px' }}>
                  DOOR OPEN
                </span>
                <span style={{ fontSize: '32px', fontWeight: 800, color: '#000000' }}>
                  {formData.do ? `${formData.do} (LT)` : ''}
                </span>
              </div>

              <div style={{ padding: '6px 0', borderBottom: '2px solid #ccc' }}>
                <span style={{ display: 'block', fontSize: '20px', color: '#003366', fontWeight: 900, marginBottom: '4px' }}>
                  ALL DISEM
                </span>
                <span style={{ fontSize: '32px', fontWeight: 800, color: '#000000' }}>
                  {formData.disem ? `${formData.disem} (LT)` : ''}
                </span>
              </div>
            </div>
          </>
        )}

        {/* Departure Info */}
        <div
          style={{
            background: '#003366',
            color: '#ffffff',
            padding: '10px 30px',
            fontSize: '28px',
            fontWeight: 900,
            borderTop: '3px solid #000000',
            borderBottom: '3px solid #000000',
            textTransform: 'uppercase'
          }}
        >
          DEPARTURE INFORMATION
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '20px',
            padding: '12px 30px'
          }}
        >
          <div style={{ padding: '6px 0', borderBottom: '2px solid #ccc' }}>
            <span style={{ display: 'block', fontSize: '20px', color: '#003366', fontWeight: 900, marginBottom: '4px' }}>
              FLIGHT
            </span>
            <span style={{ fontSize: '32px', fontWeight: 800, color: '#000000' }}>
              {formData.deptFlt ? `BS-${formData.deptFlt}` : ''}
            </span>
          </div>

          <div style={{ padding: '6px 0', borderBottom: '2px solid #ccc' }}>
            <span style={{ display: 'block', fontSize: '20px', color: '#003366', fontWeight: 900, marginBottom: '4px' }}>
              ROUTE
            </span>
            <span style={{ fontSize: '32px', fontWeight: 800, color: '#000000' }}>
              {formData.deptRoute || ''}
            </span>
          </div>

          <div style={{ padding: '6px 0', borderBottom: '2px solid #ccc' }}>
            <span style={{ display: 'block', fontSize: '20px', color: '#003366', fontWeight: 900, marginBottom: '4px' }}>
              STD
            </span>
            <span style={{ fontSize: '32px', fontWeight: 800, color: '#000000' }}>
              {formData.std ? `${formData.std} (LT)` : ''}
            </span>
          </div>

          <div style={{ padding: '6px 0', borderBottom: '2px solid #ccc' }}>
            <span style={{ display: 'block', fontSize: '20px', color: '#003366', fontWeight: 900, marginBottom: '4px' }}>
              DOOR CLOSE
            </span>
            <span style={{ fontSize: '32px', fontWeight: 800, color: '#000000' }}>
              {formData.dc ? `${formData.dc} (LT)` : ''}
            </span>
          </div>

          <div style={{ padding: '6px 0', borderBottom: '2px solid #ccc' }}>
            <span style={{ display: 'block', fontSize: '20px', color: '#003366', fontWeight: 900, marginBottom: '4px' }}>
              C/OFF
            </span>
            <span style={{ fontSize: '32px', fontWeight: 800, color: '#000000' }}>
              {formData.co ? `${formData.co} (LT)` : ''}
            </span>
          </div>

          <div style={{ padding: '6px 0', borderBottom: '2px solid #ccc' }}>
            <span style={{ display: 'block', fontSize: '20px', color: '#003366', fontWeight: 900, marginBottom: '4px' }}>
              A/B
            </span>
            <span style={{ fontSize: '32px', fontWeight: 800, color: '#000000' }}>
              {formData.ab ? `${formData.ab} (LT)` : ''}
            </span>
          </div>
        </div>

        {/* Status Bar */}
        <div
          style={{
            textAlign: 'center',
            fontSize: '32px',
            fontWeight: 900,
            padding: '12px',
            color: '#000000',
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '2px',
            backgroundColor: '#ffff00',
            borderTop: '3px solid #000000',
            borderBottom: '3px solid #000000'
          }}
        >
          {formData.status || 'FLIGHT IS ONTIME'}
        </div>

        {/* Timings Table - 2 Columns Side-By-Side Grid */}
        <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '3px solid #000000' }}>
          <tbody>
            <style>{`
              .rpt-cell-lbl { padding: 12px 16px; font-size: 22px; font-weight: 800; color: #000000; border-bottom: 2px solid #ddd; text-transform: uppercase; }
              .rpt-cell-val { padding: 12px 16px; font-size: 28px; font-weight: 900; color: #000000; border-bottom: 2px solid #ddd; text-align: center; font-family: Arial, Helvetica, sans-serif; letter-spacing: 0.5px; }
            `}</style>
            
            <tr>
              <td className="rpt-cell-lbl" style={{ width: '32%', borderRight: '1px solid #ccc' }}>1. SECURITY CHECK ST</td>
              <td className="rpt-cell-val" style={{ width: '18%', borderRight: '3px solid #000' }}>{formatTimeLT(formData.securitySt)}</td>
              <td className="rpt-cell-lbl" style={{ width: '32%', borderRight: '1px solid #ccc' }}>2. SECURITY CHECK END</td>
              <td className="rpt-cell-val" style={{ width: '18%' }}>{formatTimeLT(formData.securityEnd)}</td>
            </tr>

            <tr>
              <td className="rpt-cell-lbl" style={{ borderRight: '1px solid #ccc' }}>3. CLEANING START</td>
              <td className="rpt-cell-val" style={{ borderRight: '3px solid #000' }}>{formatTimeLT(formData.cleaningSt)}</td>
              <td className="rpt-cell-lbl" style={{ borderRight: '1px solid #ccc' }}>4. CLEANING END</td>
              <td className="rpt-cell-val">{formatTimeLT(formData.cleaningEnd)}</td>
            </tr>

            <tr>
              <td className="rpt-cell-lbl" style={{ borderRight: '1px solid #ccc' }}>5. CATERING START</td>
              <td className="rpt-cell-val" style={{ borderRight: '3px solid #000' }}>{formatTimeLT(formData.cateringSt)}</td>
              <td className="rpt-cell-lbl" style={{ borderRight: '1px solid #ccc' }}>6. CATERING END</td>
              <td className="rpt-cell-val">{formatTimeLT(formData.cateringEnd)}</td>
            </tr>

            <tr>
              <td className="rpt-cell-lbl" style={{ borderRight: '1px solid #ccc' }}>7. CREW REPORT</td>
              <td className="rpt-cell-val" style={{ borderRight: '3px solid #000' }}>{formatTimeLT(formData.crew)}</td>
              <td className="rpt-cell-lbl" style={{ borderRight: '1px solid #ccc' }}>8. REFUELING DONE</td>
              <td className="rpt-cell-val">{formatTimeLT(formData.refuel)}</td>
            </tr>

            <tr>
              <td className="rpt-cell-lbl" style={{ borderRight: '1px solid #ccc' }}>9. LAST BAGGAGE REPORT</td>
              <td className="rpt-cell-val" style={{ borderRight: '3px solid #000' }}>{formatTimeLT(formData.lbag)}</td>
              <td className="rpt-cell-lbl" style={{ borderRight: '1px solid #ccc' }}>10. BOARDING PERMITTED</td>
              <td className="rpt-cell-val">{formatTimeLT(formData.permit)}</td>
            </tr>

            <tr>
              <td className="rpt-cell-lbl" style={{ borderRight: '1px solid #ccc' }}>11. LAST PAX ONBOARD</td>
              <td className="rpt-cell-val" style={{ borderRight: '3px solid #000' }}>{formatTimeLT(formData.pax)}</td>
              <td className="rpt-cell-lbl" style={{ borderRight: '1px solid #ccc' }}>12. TRIM SUBMITTED</td>
              <td className="rpt-cell-val">{formatTimeLT(formData.trimSubmitted)}</td>
            </tr>

            {/* Item 13 (TRIM SIGNED) and Optional Baggage Fields: 14. PRIORITY BAG, 15. VIP BAG, 16. OFFLOAD BAG */}
            {(() => {
              const pBag = formatBagCount(formData.priorityBag);
              const vBag = formatBagCount(formData.vipBag);
              const oBag = formatBagCount(formData.offloadBag);

              const items: { label: string; val: string }[] = [
                { label: '13. TRIM SIGNED', val: formatTimeLT(formData.trimSigned) }
              ];

              if (pBag) items.push({ label: '14. PRIORITY BAG', val: pBag });
              if (vBag) items.push({ label: '15. VIP BAG', val: vBag });
              if (oBag) items.push({ label: '16. OFFLOAD BAG', val: oBag });

              const rows = [];
              for (let i = 0; i < items.length; i += 2) {
                const item1 = items[i];
                const item2 = items[i + 1];
                rows.push(
                  <tr key={`milestone-row-${i}`}>
                    <td className="rpt-cell-lbl" style={{ width: '32%', borderRight: '1px solid #ccc' }}>{item1.label}</td>
                    <td className="rpt-cell-val" style={{ width: '18%', borderRight: item2 ? '3px solid #000' : 'none' }}>{item1.val}</td>
                    {item2 ? (
                      <>
                        <td className="rpt-cell-lbl" style={{ width: '32%', borderRight: '1px solid #ccc' }}>{item2.label}</td>
                        <td className="rpt-cell-val" style={{ width: '18%' }}>{item2.val}</td>
                      </>
                    ) : (
                      <>
                        <td className="rpt-cell-lbl" style={{ width: '32%', borderRight: '1px solid #ccc' }}></td>
                        <td className="rpt-cell-val" style={{ width: '18%' }}></td>
                      </>
                    )}
                  </tr>
                );
              }
              return rows;
            })()}
          </tbody>
        </table>

        {/* Bottom Ground Time Bar */}
        <div
          style={{
            textAlign: 'center',
            fontSize: '32px',
            fontWeight: 900,
            padding: '12px',
            color: '#000000',
            backgroundColor: '#ffff00',
            borderTop: '3px solid #000000',
            borderBottom: '3px solid #000000',
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}
        >
          GROUND TIME {mode === 'DIRECT' || formData.ground === 'ON GROUND' ? 'ON GROUND' : `${formData.ground || '0'} MINS`}
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: '4px solid #003366',
            padding: '25px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#ffffff'
          }}
        >
          {/* Highlighted Reason for Flight Delay Box if flight is delayed */}
          <div style={{ flex: '1', paddingRight: '25px' }}>
            {isDelay && (
              <div
                style={{
                  background: '#fff3cd',
                  border: '4px solid #dc3545',
                  borderRadius: '12px',
                  padding: '16px 20px'
                }}
              >
                <div
                  style={{
                    fontSize: '22px',
                    fontWeight: 900,
                    color: '#721c24',
                    textTransform: 'uppercase',
                    marginBottom: '6px'
                  }}
                >
                  ⚠️ DELAY CODE:
                </div>
                <div
                  style={{
                    fontSize: '26px',
                    fontWeight: 900,
                    color: '#000000',
                    lineHeight: '1.4',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {formData.delayReason || 'DELAY CODE NOT SPECIFIED'}
                </div>
              </div>
            )}
          </div>

          <div style={{ textAlign: 'center', minWidth: '380px' }}>
            <div
              style={{
                background: '#ffffff',
                color: '#000000',
                padding: '15px',
                borderTop: '6px solid #003366'
              }}
            >
              <div
                style={{
                  fontWeight: 900,
                  fontSize: '36px',
                  textTransform: 'uppercase'
                }}
              >
                {user.name}
              </div>
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: 'bold',
                  margin: '5px 0'
                }}
              >
                USBA ID- {user.id}
              </div>
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  marginTop: '8px',
                  paddingTop: '8px',
                  borderTop: '2px solid #ccc'
                }}
              >
                RAMP OFFICER / <span>{user.station}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
