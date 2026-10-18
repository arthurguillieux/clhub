/**
 * The TV's backdrop: a big, plain laboratory seen in perspective — a tiled floor catching the light,
 * strip lights on the ceiling, panelled walls with a line of cyan light running to the back, and a
 * sealed door at the far end. Pure CSS 3D (five planes in a `perspective` stage), so it costs
 * nothing to run; the camera drifts very slowly unless reduced motion is asked for.
 * The stage is a bit larger than the screen so the drift never shows an edge; the outer frame clips it.
 */
export function LabRoom() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="lab-stage">
        <div className="lab-room">
          <div className="lab-face lab-back">
            <div className="lab-door">
              <span className="lab-door-seam" />
            </div>
            <div className="lab-back-strip" />
          </div>
          <div className="lab-face lab-floor" />
          <div className="lab-face lab-ceiling">
            <span className="lab-light" style={{ left: "22%" }} />
            <span className="lab-light" style={{ left: "50%" }} />
            <span className="lab-light" style={{ left: "78%" }} />
          </div>
          <div className="lab-face lab-wall lab-wall-left">
            <span className="lab-wall-strip" />
          </div>
          <div className="lab-face lab-wall lab-wall-right">
            <span className="lab-wall-strip" />
          </div>
        </div>
        <div className="lab-haze" />
      </div>
    </div>
  );
}
