/* global QUnit */
QUnit.config.autostart = false;

sap.ui.require([
	// Controls
	// internal
	'sap/ui/rta/RuntimeAuthoring',
	'sap/ui/fl/FakeLrepConnectorSessionStorage',
	'sap/ui/fl/FakeLrepSessionStorage',
	'sap/ui/dt/OverlayRegistry',
	'sap/ui/rta/qunit/RtaQunitUtils',
	"sap/ui/fl/ChangePersistenceFactory",
	'sap/ui/thirdparty/sinon'

], function(
	RuntimeAuthoring,
	FakeLrepConnectorSessionStorage,
	FakeLrepSessionStorage,
	OverlayRegistry,
	RtaQunitUtils,
	ChangePersistenceFactory,
	sinon
) {
	"use strict";

	var sandbox = sinon.sandbox.create();

	QUnit.start();

	// FIXME: change as soon as a public method for this is available
	var fnWaitForExecutionAndSerializationBeingDone = function() {
		return this.oRta.getCommandStack()._oLastCommand;
	};

	FakeLrepConnectorSessionStorage.enableFakeConnector();
	QUnit.module("Given RTA is started...", {
		beforeEach : function(assert) {
			this._oCompCont = RtaQunitUtils.renderTestAppAt("test-view");

			var that = this;
			FakeLrepSessionStorage.deleteChanges();
			assert.equal(FakeLrepSessionStorage.getNumChanges(), 0, "Local storage based LREP is empty");
			this.oCompanyCodeField = sap.ui.getCore().byId("Comp1---idMain1--GeneralLedgerDocument.CompanyCode");
			this.oBoundButton35Field = sap.ui.getCore().byId("Comp1---idMain1--Dates.BoundButton35");
			this.oGroup = sap.ui.getCore().byId("Comp1---idMain1--Dates");
			this.oGeneralGroup = sap.ui.getCore().byId("Comp1---idMain1--GeneralLedgerDocument");
			this.oForm = sap.ui.getCore().byId("Comp1---idMain1--MainForm");
			this.oRta = new RuntimeAuthoring({
				rootControl : this._oCompCont.getComponentInstance().getAggregation("rootControl")
			});

			return Promise.all([
				new Promise(function (fnResolve) {
					this._oCompCont.getComponentInstance().oView.getModel().attachEventOnce('metadataLoaded', fnResolve);
				}.bind(this)),
				new Promise(function (fnResolve) {
					this.oRta.attachStart(function () {
						this.oCompanyCodeFieldOverlay = OverlayRegistry.getOverlay(that.oCompanyCodeField);
						this.oGroupOverlay = OverlayRegistry.getOverlay(that.oGroup);
						this.ooGeneralGroupOverlay = OverlayRegistry.getOverlay(that.oGeneralGroup);
						this.oBoundButton35FieldOverlay = OverlayRegistry.getOverlay(that.oBoundButton35Field);
						fnResolve();
					}.bind(this));
				}.bind(this)),
				this.oRta.start()
			]);
		},
		afterEach : function(assert) {
			this.oRta.destroy();
			this._oCompCont.destroy();
			FakeLrepSessionStorage.deleteChanges();
			sandbox.restore();
		}
	});

	QUnit.test("when removing a field,", function(assert) {
		RtaQunitUtils.waitForChangesToReachedLrepAtTheEnd(1, assert);

		var oCommandStack = this.oRta.getCommandStack();

		var oChangePersistence = ChangePersistenceFactory.getChangePersistenceForControl(this.oBoundButton35Field);
		assert.equal(oChangePersistence.getDirtyChanges().length, 0, "then there is no dirty change in the FL ChangePersistence");

		oCommandStack.attachModified(function() {
			var oFirstExecutedCommand = oCommandStack.getAllExecutedCommands()[0];
			if (oFirstExecutedCommand &&
				oFirstExecutedCommand.getName() === 'remove') {
					//TODO fix timing as modified is called before serializer is triggered...
				fnWaitForExecutionAndSerializationBeingDone.call(this).then(function() {
					assert.strictEqual(this.oBoundButton35Field.getVisible(), false, " then field is not visible");
					assert.equal(oChangePersistence.getDirtyChanges().length, 1, "then there is 1 dirty change in the FL ChangePersistence");
					this.oRta.stop();
				}.bind(this));
			}
		}.bind(this));

		this.oBoundButton35FieldOverlay.focus();
		sap.ui.test.qunit.triggerKeydown(this.oBoundButton35FieldOverlay.getDomRef(), jQuery.sap.KeyCodes.ENTER, false, false, false);

		this.oBoundButton35FieldOverlay.focus();
		sap.ui.test.qunit.triggerKeydown(this.oBoundButton35FieldOverlay.getDomRef(), jQuery.sap.KeyCodes.DELETE);
	});

	QUnit.test("when moving a field (via cut and paste),", function(assert) {
		RtaQunitUtils.waitForChangesToReachedLrepAtTheEnd(1, assert);
		var oCommandStack = this.oRta.getCommandStack();

		var oChangePersistence = ChangePersistenceFactory.getChangePersistenceForControl(this.oCompanyCodeField);
		assert.equal(oChangePersistence.getDirtyChanges().length, 0, "then there is no dirty change in the FL ChangePersistence");

		oCommandStack.attachModified(function(oEvent) {
			var oFirstExecutedCommand = oCommandStack.getAllExecutedCommands()[0];
			if (oFirstExecutedCommand &&
				oFirstExecutedCommand.getName() === "move") {
				fnWaitForExecutionAndSerializationBeingDone.call(this).then(function() {
					var iIndex = this.oGroup.getGroupElements().length - 1;
					assert.equal(this.oGroup.getGroupElements()[iIndex].getId(), this.oCompanyCodeField.getId(), " then the field is moved");
					assert.equal(oChangePersistence.getDirtyChanges().length, 1, "then there is 1 dirty change in the FL ChangePersistence");
					this.oRta.stop();
				}.bind(this));
			}
		}.bind(this));

		sap.ui.test.qunit.triggerKeydown(this.oCompanyCodeFieldOverlay.getDomRef(), jQuery.sap.KeyCodes.X, false, false, true);
		sap.ui.test.qunit.triggerKeydown(this.oGroupOverlay.getDomRef(), jQuery.sap.KeyCodes.V, false, false, true);
	});

	QUnit.test("when renaming a group (via double click) and setting a new title to Test...", function(assert) {
		RtaQunitUtils.waitForChangesToReachedLrepAtTheEnd(1, assert);
		var oChangePersistence = ChangePersistenceFactory.getChangePersistenceForControl(this.oGroup);
		assert.equal(oChangePersistence.getDirtyChanges().length, 0, "then there is no dirty change in the FL ChangePersistence");

		this.oGroupOverlay.focus();
		var $groupOverlay = this.oGroupOverlay.$();

		var done = assert.async();

		sap.ui.getCore().getEventBus().subscribeOnce('sap.ui.rta', 'plugin.Rename.startEdit', function (sChannel, sEvent, mParams) {
			if (mParams.overlay === this.oGroupOverlay) {
				var $editableField = $groupOverlay.find(".sapUiRtaEditableField");

				assert.strictEqual($editableField.length, 1, " then the rename input field is rendered");
				assert.strictEqual($editableField.find(document.activeElement).length, 1, " and focus is in it");

				Promise.all([
					new Promise(function (fnResolve) {
						var oCommandStack = this.oRta.getCommandStack();
						oCommandStack.attachModified(function(oEvent) {
							var oFirstExecutedCommand = oCommandStack.getAllExecutedCommands()[0];
							if (oFirstExecutedCommand &&
								oFirstExecutedCommand.getName() === "rename") {
								fnWaitForExecutionAndSerializationBeingDone.call(this).then(function() {
									assert.strictEqual(this.oGroup.getLabel(), "Test", "then title of the group is Test");
									assert.equal(oChangePersistence.getDirtyChanges().length, 1, "then there is 1 dirty change in the FL ChangePersistence");
									fnResolve();
								}.bind(this));
							}
						}.bind(this));
					}.bind(this)),
					new Promise(function (fnResolve) {
						sap.ui.getCore().getEventBus().subscribeOnce('sap.ui.rta', 'plugin.Rename.stopEdit', function (sChannel, sEvent, mParams) {
							if (mParams.overlay === this.oGroupOverlay) {
								assert.strictEqual(this.oGroupOverlay.getDomRef(), document.activeElement, " and focus is on group overlay");
								$editableField = $groupOverlay.find(".sapUiRtaEditableField");
								assert.strictEqual($editableField.length, 0, " and the editable field is removed from dom");
								fnResolve();
							}
						}, this);
					}.bind(this))
				]).then(function () {
					this.oRta.stop().then(done);
				}.bind(this));

				document.activeElement.innerHTML = "Test";
				sap.ui.test.qunit.triggerKeydown(document.activeElement, jQuery.sap.KeyCodes.ENTER, false, false, false);
			}
		}, this);

		$groupOverlay.click();
		$groupOverlay.click();
	});

	var fnPressRenameAndEnsureFunctionality = function(assert, oChangePersistence, oRenameButton) {
		var $fieldOverlay = this.oCompanyCodeFieldOverlay.$();

		return new Promise(function(fnResolve, fnReject) {
			oRenameButton.firePress();

			sap.ui.getCore().getEventBus().subscribeOnce('sap.ui.rta', 'plugin.Rename.startEdit', function (sChannel, sEvent, mParams) {
				if (mParams.overlay === this.oCompanyCodeFieldOverlay) {
					var $editableField = $fieldOverlay.find(".sapUiRtaEditableField");

					assert.strictEqual($editableField.length, 1, " then the rename input field is rendered");
					assert.strictEqual($editableField.find(document.activeElement).length, 1, " and focus is in it");

					Promise.all([
						new Promise(function (fnResolve) {
							var oCommandStack = this.oRta.getCommandStack();
							oCommandStack.attachModified(function(oEvent) {
								var oFirstExecutedCommand = oCommandStack.getAllExecutedCommands()[0];
								if (oFirstExecutedCommand && oFirstExecutedCommand.getName() === "rename") {
									fnWaitForExecutionAndSerializationBeingDone.call(this).then(function() {
										assert.strictEqual(this.oCompanyCodeField._getLabel().getText(), "Test", "then label of the group element is Test");
										assert.equal(oChangePersistence.getDirtyChanges().length, 1, "then there is 1 dirty change in the FL ChangePersistence");
										fnResolve();
									}.bind(this));
								}
							}.bind(this));
						}.bind(this)),
						new Promise(function (fnResolve) {
							sap.ui.getCore().getEventBus().subscribeOnce('sap.ui.rta', 'plugin.Rename.stopEdit', function (sChannel, sEvent, mParams) {
								if (mParams.overlay === this.oCompanyCodeFieldOverlay) {
									assert.strictEqual(document.activeElement, this.oCompanyCodeFieldOverlay.getDomRef(), " and focus is on field overlay");
									$editableField = $fieldOverlay.find(".sapUiRtaEditableField");
									assert.strictEqual($editableField.length, 0, " and the editable field is removed from dom");
									fnResolve();
								}
							}, this);
						}.bind(this))
					]).then(function () {
						return this.oRta.stop();
					}.bind(this))
					.then(fnResolve);

					document.activeElement.innerHTML = "Test";
					sap.ui.test.qunit.triggerKeydown(document.activeElement, jQuery.sap.KeyCodes.ENTER, false, false, false);
				}
			}, this);
		}.bind(this));
	};

	QUnit.test("when renaming a group element via Context menu (compact context menu) and setting a new label to Test...", function(assert) {
		RtaQunitUtils.waitForChangesToReachedLrepAtTheEnd(1, assert);
		var done = assert.async();

		var oChangePersistence = ChangePersistenceFactory.getChangePersistenceForControl(this.oCompanyCodeField);
		assert.equal(oChangePersistence.getDirtyChanges().length, 0, "then there is no dirty change in the FL ChangePersistence");

		this.oCompanyCodeFieldOverlay.focus();

		var oContextMenuControl = this.oRta.getPlugins()["contextMenu"].oContextMenuControl;
		oContextMenuControl.attachOpened(function() {
			assert.ok(oContextMenuControl.bOpen, "ContextMenu should be opened");
			// press rename button
			var oRenameButton = oContextMenuControl.getButtons()[0];
			fnPressRenameAndEnsureFunctionality.call(this, assert, oChangePersistence, oRenameButton)
				.then(done);
		}.bind(this));

		// open context menu (compact menu)
		sap.ui.test.qunit.triggerMouseEvent(this.oCompanyCodeFieldOverlay.getDomRef(), "click");
	});

	QUnit.test("when renaming a group element via context menu (expanded context menu) and setting a new label to Test...", function(assert) {
		RtaQunitUtils.waitForChangesToReachedLrepAtTheEnd(1, assert);

		var oChangePersistence = ChangePersistenceFactory.getChangePersistenceForControl(this.oCompanyCodeField);
		assert.equal(oChangePersistence.getDirtyChanges().length, 0, "then there is no dirty change in the FL ChangePersistence");

		this.oCompanyCodeFieldOverlay.focus();

		// open context menu (expanded menu) and press rename button
		sap.ui.test.qunit.triggerKeydown(this.oCompanyCodeFieldOverlay.getDomRef(), jQuery.sap.KeyCodes.F10, true, false, false);
		var oContextMenuButton = this.oRta.getPlugins()["contextMenu"].oContextMenuControl.getButtons()[0];

		return fnPressRenameAndEnsureFunctionality.call(this, assert, oChangePersistence, oContextMenuButton);
	});

	QUnit.test("when adding a group element via context menu (expanded context menu - addODataProperty", function(assert) {
		RtaQunitUtils.waitForChangesToReachedLrepAtTheEnd(2, assert);
		var done = assert.async();

		var oChangePersistence = ChangePersistenceFactory.getChangePersistenceForControl(this.oCompanyCodeField);
		assert.equal(oChangePersistence.getDirtyChanges().length, 0, "then there is no dirty change in the FL ChangePersistence");

		var oDialog = this.oRta.getPlugins()["additionalElements"].getDialog();
		this.oCompanyCodeFieldOverlay.focus();

		// open context menu (context menu) and press rename button
		sap.ui.test.qunit.triggerKeydown(this.oCompanyCodeFieldOverlay.getDomRef(), jQuery.sap.KeyCodes.F10, true, false, false);
		var oContextMenuControl = this.oRta.getPlugins()["contextMenu"].oContextMenuControl;
		oContextMenuControl.attachEventOnce("Opened", function() {
			var oContextMenuButton = oContextMenuControl.getButtons()[1];
			assert.equal(oContextMenuButton.getText(), "Add: Field", "the the add field action button is available in the menu");
			oContextMenuButton.firePress();
			sap.ui.getCore().applyChanges();
		});

		oDialog.attachOpened(function() {
			var oFieldToAdd = oDialog._oList.getItems()[1];
			var sFieldToAddText = oFieldToAdd.getContent()[0].getItems()[0].getText();

			// observer gets called when the Group changes. Then the new field is on the UI.
			var oObserver = new MutationObserver(function(mutations) {
				var oGroupElements = this.oGeneralGroup.getGroupElements();
				var iIndex = oGroupElements.indexOf(this.oCompanyCodeField) + 1;
				assert.equal(oGroupElements[iIndex].getLabelText(), sFieldToAddText, "the added element is at the correct position");
				assert.ok(oGroupElements[iIndex].getVisible(), "the new field is visible");
				assert.equal(oChangePersistence.getDirtyChanges().length, 1, "then there is 1 dirty change in the FL ChangePersistence");

				oObserver.disconnect();
				this.oRta.stop().then(done);
			}.bind(this));
			var oConfig = { attributes: false, childList: true, characterData: false, subtree : true};
			oObserver.observe(this.oForm.getDomRef(), oConfig);

			// select the field in the list and close the dialog with OK
			oFieldToAdd.focus();
			sap.ui.test.qunit.triggerKeydown(oFieldToAdd.getDomRef(), jQuery.sap.KeyCodes.ENTER, false, false, false);
			sap.ui.qunit.QUnitUtils.triggerEvent("tap", oDialog._oOKButton.getDomRef());
			sap.ui.getCore().applyChanges();

		}.bind(this));
	});

	QUnit.test("when adding a group element via context menu (expanded context menu - reveal", function(assert) {
		RtaQunitUtils.waitForChangesToReachedLrepAtTheEnd(3, assert);
		var done = assert.async();

		var oChangePersistence = ChangePersistenceFactory.getChangePersistenceForControl(this.oCompanyCodeField);
		assert.equal(oChangePersistence.getDirtyChanges().length, 0, "then there is no dirty change in the FL ChangePersistence");

		var oCommandStack = this.oRta.getCommandStack();
		oCommandStack.attachEventOnce("commandExecuted", function() {
			setTimeout(function() {
				// remove field is executed, reveal should be available
				var oDialog = this.oRta.getPlugins()["additionalElements"].getDialog();
				this.oCompanyCodeFieldOverlay.focus();

				// open context menu dialog
				sap.ui.test.qunit.triggerKeydown(this.oCompanyCodeFieldOverlay.getDomRef(), jQuery.sap.KeyCodes.F10, true, false, false);
				var oContextMenuButton = this.oRta.getPlugins()["contextMenu"].oContextMenuControl.getButtons()[1];
				oContextMenuButton.firePress();
				sap.ui.getCore().applyChanges();

				oDialog.attachOpened(function() {
					var oFieldToAdd = oDialog.getElements().filter(function(oField) {return oField.type === "invisible";})[0];
					oCommandStack.attachModified(function(oEvent) {
						var aCommands = oCommandStack.getAllExecutedCommands();
						if (aCommands &&
							aCommands.length  === 3) {
							sap.ui.getCore().applyChanges();

							fnWaitForExecutionAndSerializationBeingDone.call(this).then(function() {
								var oGroupElements = this.oGeneralGroup.getGroupElements();
								var iIndex = oGroupElements.indexOf(this.oCompanyCodeField) + 1;
								assert.equal(oGroupElements[iIndex].getLabelText(), oFieldToAdd.label, "the added element is at the correct position");
								assert.ok(oGroupElements[iIndex].getVisible(), "the new field is visible");
								assert.equal(this.oBoundButton35Field.fieldLabel, oFieldToAdd.label, "the new field is the one that got deleted");
								assert.equal(oChangePersistence.getDirtyChanges().length, 3, "then there are 3 dirty change in the FL ChangePersistence");
							}.bind(this))

							.then(this.oRta.stop.bind(this.oRta))

							.then(done);
							}
					}.bind(this));

					// select the field in the list and close the dialog with OK
					oFieldToAdd.selected = true;
					sap.ui.qunit.QUnitUtils.triggerEvent("tap", oDialog._oOKButton.getDomRef());
					sap.ui.getCore().applyChanges();
				}.bind(this));
			}.bind(this), 0);
		}.bind(this));

		// to reveal we have to remove the field first (otherwise it would be addODataProperty)
		this.oBoundButton35FieldOverlay.focus();
		sap.ui.test.qunit.triggerKeydown(this.oBoundButton35FieldOverlay.getDomRef(), jQuery.sap.KeyCodes.ENTER, false, false, false);
		this.oBoundButton35FieldOverlay.focus();
		sap.ui.test.qunit.triggerKeydown(this.oBoundButton35FieldOverlay.getDomRef(), jQuery.sap.KeyCodes.DELETE);
	});

	QUnit.test("when adding a SimpleForm Field via context menu (expanded context menu) - reveal", function(assert) {
		RtaQunitUtils.waitForChangesToReachedLrepAtTheEnd(3, assert);
		var done = assert.async();

		var oForm = sap.ui.getCore().byId("Comp1---idMain1--SimpleForm--Form");
		var oFormContainer = oForm.getFormContainers()[0];
		var oFieldToHide = oFormContainer.getFormElements()[0];
		var oFieldToHideOverlay = OverlayRegistry.getOverlay(oFieldToHide);

		var oChangePersistence = ChangePersistenceFactory.getChangePersistenceForControl(this.oCompanyCodeField);
		assert.equal(oChangePersistence.getDirtyChanges().length, 0, "then there is no dirty change in the FL ChangePersistence");

		var oCommandStack = this.oRta.getCommandStack();
		oCommandStack.attachEventOnce("commandExecuted", function() {
			setTimeout(function() {
				// remove field is executed, reveal should be available
				var oDialog = this.oRta.getPlugins()["additionalElements"].getDialog();
				oFormContainer = oForm.getFormContainers()[0];
				var oField = oFormContainer.getFormElements()[1];
				var oFieldOverlay = OverlayRegistry.getOverlay(oField);
				oFieldOverlay.focus();

				// open context menu (compact context menu)
				sap.ui.test.qunit.triggerKeydown(oFieldOverlay.getDomRef(), jQuery.sap.KeyCodes.F10, true, false, false);
				var oContextMenuControl = this.oRta.getPlugins()["contextMenu"].oContextMenuControl;
				oContextMenuControl.attachOpened(function() {
					var oContextMenuButton = oContextMenuControl.getButtons()[1];
					assert.equal(oContextMenuButton.getText(), "Add: Field", "the the add field action button is available in the menu");
					oContextMenuButton.firePress();
					sap.ui.getCore().applyChanges();
				});

				// wait for opening additional Elements dialog
				oDialog.attachOpened(function() {
					var oFieldToAdd = oDialog.getElements().filter(function(oField) {return oField.type === "invisible";})[0];
					oCommandStack.attachModified(function(oEvent) {
						var aCommands = oCommandStack.getAllExecutedCommands();
						if (aCommands &&
							aCommands.length  === 3) {
							fnWaitForExecutionAndSerializationBeingDone.call(this).then(function() {
								sap.ui.getCore().applyChanges();
								assert.equal(oChangePersistence.getDirtyChanges().length, 3, "then there are 3 dirty change in the FL ChangePersistence");
							})
							.then(this.oRta.stop.bind(this.oRta))

							.then(done);
						}
					}.bind(this));

					// select the field in the list and close the dialog with OK
					oFieldToAdd.selected = true;
					sap.ui.qunit.QUnitUtils.triggerEvent("tap", oDialog._oOKButton.getDomRef());
					sap.ui.getCore().applyChanges();
				}.bind(this));
			}.bind(this), 0);
		}.bind(this));

		// to reveal we have to remove the field first (otherwise it would be addODataProperty)
		oFieldToHideOverlay.focus();
		sap.ui.test.qunit.triggerKeydown(oFieldToHideOverlay.getDomRef(), jQuery.sap.KeyCodes.F10, true, false, false);
		var oContextMenuControl = this.oRta.getPlugins()["contextMenu"].oContextMenuControl;
		oContextMenuControl.attachEventOnce("Opened", function() {
			var oContextMenuButton = oContextMenuControl.getButtons()[2];
			assert.equal(oContextMenuButton.getText(), "Remove", "the the add field action button is available in the menu");
			oContextMenuButton.firePress();
			sap.ui.getCore().applyChanges();
		});

	});

	QUnit.test("when splitting a combined SmartForm GroupElement via context menu (expanded context menu) - split", function(assert) {
		RtaQunitUtils.waitForChangesToReachedLrepAtTheEnd(3, assert);
		var done = assert.async();

		var oCombinedElement = sap.ui.getCore().byId("Comp1---idMain1--Dates.BoundButton35");
		var oCombinedElementOverlay = OverlayRegistry.getOverlay(oCombinedElement);

		var oChangePersistence = ChangePersistenceFactory.getChangePersistenceForControl(oCombinedElement);
		assert.equal(oChangePersistence.getDirtyChanges().length, 0, "then there is no dirty change in the FL ChangePersistence");

		var oCommandStack = this.oRta.getCommandStack();
		oCommandStack.attachModified(function(oEvent) {
			var aCommands = oCommandStack.getAllExecutedCommands();
			if (aCommands &&
				aCommands.length  === 1) {
				fnWaitForExecutionAndSerializationBeingDone.call(this).then(function() {
					sap.ui.getCore().applyChanges();
					assert.equal(oChangePersistence.getDirtyChanges().length, 1, "then there ia a dirty change in the FL ChangePersistence");
				})
				.then(this.oRta.stop.bind(this.oRta))

				.then(done);
			}
		}.bind(this));

		// open context menu (expanded context menu) on fucused overlay
		oCombinedElementOverlay.focus();
		sap.ui.test.qunit.triggerKeydown(oCombinedElementOverlay.getDomRef(), jQuery.sap.KeyCodes.F10, true, false, false);

		// trigger split event
		var oContextMenuButton = this.oRta.getPlugins()["contextMenu"].oContextMenuControl.getButtons()[5];
		oContextMenuButton.firePress();
		sap.ui.getCore().applyChanges();

	});

	RtaQunitUtils.removeTestViewAfterTestsWhenCoverageIsRequested();
});
