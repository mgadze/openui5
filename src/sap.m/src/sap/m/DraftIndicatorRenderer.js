/**
 * @copyright
 */
sap.ui.define(['jquery.sap.global'],
	function(jQuery) {
	"use strict";


	/**
	 * DraftIndicator renderer.
	 * @namespace
	 */
	var DraftIndicatorRenderer = {};
	
	/**
	 * Renders the HTML for the given control, using the provided {@link sap.ui.core.RenderManager}.
	 *
	 * @param {sap.ui.core.RenderManager} oRm the RenderManager that can be used for writing to the render output buffer
	 * @param {sap.ui.core.Control} oControl an object representation of the control that should be rendered
	 */
	DraftIndicatorRenderer.render = function(oRm, oControl) {
		
		oRm.write("<div");
		oRm.writeControlData(oControl);
		oRm.addClass("sapMDraftIndicator");
		oRm.writeClasses();
		oRm.write(">");

		var oLabel = oControl._getLabel();

		oRm.renderControl(oLabel);

		oRm.write("</div>");
	};


	return DraftIndicatorRenderer;

}, /* bExport= */ true);
