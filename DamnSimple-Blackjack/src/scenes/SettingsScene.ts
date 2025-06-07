// src/scenes/settingsscene-ts (Apply cornerRadius fix)
import { Scene, Engine, Vector3, HemisphericLight, Color3, Color4, ArcRotateCamera } from "@babylonjs/core";
import { AdvancedDynamicTexture, Button, TextBlock, StackPanel, Control, Rectangle } from "@babylonjs/gui";
import { QualityLevel, QualitySettings } from "../Constants"; // *** ADDED ***

export class SettingsScene {
    private scene: Scene;
    private guiTexture!: AdvancedDynamicTexture;
    private qualityButtons: Map<QualityLevel, Button> = new Map(); // *** ADDED ***

    constructor(
        engine: Engine, canvas: HTMLCanvasElement, onBack: () => void,
        onResetFunds: () => void, onLanguageChange: (lang: string) => void,
        onCurrencyChange: (currency: string) => void,
        onQualityChange: (level: QualityLevel) => void, // *** ADDED ***
        currentQuality: QualityLevel // *** ADDED ***
    ) {
        this.scene = new Scene(engine);
        this.scene.clearColor = new Color4(0.05, 0.1, 0.15, 1.0);
        const camera = new ArcRotateCamera("settingsCamera", -Math.PI / 2, Math.PI / 2, 5, Vector3.Zero(), this.scene);
        // camera.attachControl(canvas, true); // Usually not needed for static menu
        const light = new HemisphericLight("settingsLight", new Vector3(0, 1, 0), this.scene);
        light.intensity = 0.8;
        this.createGUI(onBack, onResetFunds, onLanguageChange, onCurrencyChange, onQualityChange, currentQuality);
    }

    private createGUI(
        onBack: () => void, onResetFunds: () => void,
        onLanguageChange: (lang: string) => void, onCurrencyChange: (currency: string) => void,
        onQualityChange: (level: QualityLevel) => void, // *** ADDED ***
        currentQuality: QualityLevel // *** ADDED ***
    ): void {
        this.guiTexture = AdvancedDynamicTexture.CreateFullscreenUI("SettingsUI", true, this.scene);

        // *** WRAPPER RECTANGLE for background/cornerRadius ***
        const panelContainer = new Rectangle("settingsPanelContainer");
        panelContainer.width = "450px";
        panelContainer.adaptHeightToChildren = true; // Auto height based on content
        panelContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        panelContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        panelContainer.background = "rgba(0, 0, 0, 0.6)"; // Darker semi-transparent background
        panelContainer.cornerRadius = 15; // Apply cornerRadius here
        panelContainer.thickness = 0; // No border for container itself
        this.guiTexture.addControl(panelContainer);

        // Main StackPanel (goes inside the container)
        const panel = new StackPanel("settingsPanel");
        // Remove background/cornerRadius from StackPanel itself
        panel.paddingTop = "20px"; panel.paddingBottom = "20px";
        panel.paddingLeft = "15px"; panel.paddingRight = "15px"; // Padding inside container
        panelContainer.addControl(panel); // Add StackPanel to Rectangle

        // Title
        const titleText = new TextBlock("settingsTitle", "Settings");
        titleText.color = "white"; titleText.fontSize = 32; titleText.height = "60px";
        panel.addControl(titleText);

        // --- Graphics Quality ---
        this.createSectionTitle(panel, "Graphics Quality");
        const qualityPanel = new StackPanel("qualityPanel");
        qualityPanel.isVertical = false; qualityPanel.height = "50px"; qualityPanel.spacing = 10;
        qualityPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        panel.addControl(qualityPanel);
        (Object.keys(QualitySettings) as QualityLevel[]).forEach(level => {
            const qualityButton = this.createOptionButton(`quality${level}Button`, level, () => {
                onQualityChange(level);
                this.updateQualityButtons(level); // Update visuals immediately
            });
            qualityButton.width = "80px";
            this.qualityButtons.set(level, qualityButton);
            qualityPanel.addControl(qualityButton);
        });
        this.updateQualityButtons(currentQuality); // Set initial active button


        // --- Language ---
        this.createSectionTitle(panel, "Language");
        const languagePanel = new StackPanel("languagePanel");
        languagePanel.isVertical = false; languagePanel.height = "50px"; languagePanel.spacing = 15;
        languagePanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER; // Center buttons
        panel.addControl(languagePanel);
        const languages = ["English", "Spanish", "French"]; // Example languages
        languages.forEach(lang => {
            const langButton = this.createOptionButton(`${lang}Button`, lang, () => onLanguageChange(lang.toLowerCase()));
            languagePanel.addControl(langButton);
        });

        // --- Currency ---
        this.createSectionTitle(panel, "Currency");
        const currencyPanel = new StackPanel("currencyPanel");
        currencyPanel.isVertical = false; currencyPanel.height = "50px"; currencyPanel.spacing = 15;
        currencyPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER; // Center buttons
        panel.addControl(currencyPanel);
        const currencies = ["$", "€", "£", "¥"]; // Example currencies
        currencies.forEach(currency => {
            const currencyButton = this.createOptionButton(`${currency}Button`, currency, () => onCurrencyChange(currency));
            currencyButton.width = "60px"; // Adjust width for single characters
            currencyPanel.addControl(currencyButton);
        });

        this.createSpacer(panel, "20px");

        // --- Reset Funds ---
        const resetFundsButton = Button.CreateSimpleButton("resetFundsButton", "Reset Funds");
        resetFundsButton.width = "200px"; resetFundsButton.height = "50px"; resetFundsButton.color = "white";
        resetFundsButton.background = "orange"; resetFundsButton.cornerRadius = 8;
        resetFundsButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER; // Center button
        resetFundsButton.onPointerUpObservable.add(() => {
            this.showConfirmDialog("Are you sure you want to reset your funds to the default amount?", onResetFunds);
        });
        panel.addControl(resetFundsButton);

        this.createSpacer(panel, "30px");

        // --- Back Button ---
        const backButton = Button.CreateSimpleButton("backButton", "Back to Game");
        backButton.width = "200px"; backButton.height = "50px"; backButton.color = "white";
        backButton.background = "cornflowerblue"; backButton.cornerRadius = 8;
        backButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER; // Center button
        backButton.onPointerUpObservable.add(onBack);
        panel.addControl(backButton);
    }

    private createSectionTitle(parent: StackPanel, text: string): void {
        const title = new TextBlock();
        title.text = text;
        title.color = "#CCCCCC"; // Lighter gray
        title.fontSize = 20;
        title.height = "40px";
        title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        title.paddingLeft = "10px";
        parent.addControl(title);
    }
    private createOptionButton(name: string, text: string, onClick: () => void): Button {
        const button = Button.CreateSimpleButton(name, text);
        button.width = "100px";
        button.height = "40px";
        button.color = "white";
        button.background = "darkgreen"; // Darker green
        button.cornerRadius = 5;
        button.onPointerUpObservable.add(onClick);
        return button;
    }

    // *** ADDED ***
    private updateQualityButtons(activeLevel: QualityLevel): void {
        this.qualityButtons.forEach((button, level) => {
            const isActive = level === activeLevel;
            button.isEnabled = !isActive;
            button.alpha = isActive ? 0.6 : 1.0; // Dim the active button
            button.background = isActive ? "gray" : "darkgreen";
        });
    }

    private createSpacer(parent: StackPanel, height: string): void {
        const spacer = new Control(); // Use Control for pure spacing
        spacer.height = height;
        parent.addControl(spacer);
    }
    private showConfirmDialog(message: string, onConfirm: () => void): void {
        // Container for the dialog + overlay
        const dialogContainer = new Rectangle("confirmDialogContainer");
        dialogContainer.width = 1.0; // Fullscreen
        dialogContainer.height = 1.0;
        dialogContainer.background = "rgba(0, 0, 0, 0.7)"; // Dark overlay
        dialogContainer.zIndex = 100; // Ensure it's on top
        this.guiTexture.addControl(dialogContainer);

        // *** ADDED: Wrapper Rectangle for the dialog panel ***
        const dialogPanelContainer = new Rectangle("confirmDialogPanelContainer");
        dialogPanelContainer.width = "400px";
        dialogPanelContainer.adaptHeightToChildren = true; // Auto height
        dialogPanelContainer.background = "#444444"; // Dark gray background on container
        dialogPanelContainer.cornerRadius = 10;      // cornerRadius on container
        dialogPanelContainer.thickness = 1;          // Optional border on container
        dialogPanelContainer.color = "#666";
        dialogPanelContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        dialogContainer.addControl(dialogPanelContainer); // Add container to overlay

        // Dialog StackPanel (goes inside the container)
        const dialogPanel = new StackPanel("confirmDialogPanel");
        // Remove background/cornerRadius from StackPanel
        dialogPanel.paddingTop = "20px";
        dialogPanel.paddingBottom = "20px";
        dialogPanel.paddingLeft = "15px";
        dialogPanel.paddingRight = "15px";
        // *** CHANGED: Add StackPanel to the new Rectangle container ***
        dialogPanelContainer.addControl(dialogPanel);

        // Dialog text (remains inside dialogPanel)
        const dialogText = new TextBlock("confirmText", message);
        dialogText.color = "white";
        dialogText.fontSize = 18;
        dialogText.height = "80px"; // Adjust as needed or use adaptHeightToChildren on container
        dialogText.textWrapping = true;
        dialogPanel.addControl(dialogText);

        // Buttons panel (remains inside dialogPanel)
        const buttonsPanel = new StackPanel("confirmButtonsPanel");
        buttonsPanel.isVertical = false;
        buttonsPanel.height = "50px";
        buttonsPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        buttonsPanel.spacing = 20;
        dialogPanel.addControl(buttonsPanel);

        // Yes button (remains inside buttonsPanel)
        const yesButton = Button.CreateSimpleButton("yesButton", "Yes");
        yesButton.width = "100px";
        yesButton.height = "40px";
        yesButton.color = "white";
        yesButton.background = "darkred"; // Confirm action color
        yesButton.cornerRadius = 5;
        yesButton.onPointerUpObservable.add(() => {
            onConfirm();
            this.guiTexture.removeControl(dialogContainer); // Dispose container
        });
        buttonsPanel.addControl(yesButton);

        // No button (remains inside buttonsPanel)
        const noButton = Button.CreateSimpleButton("noButton", "No");
        noButton.width = "100px";
        noButton.height = "40px";
        noButton.color = "white";
        noButton.background = "#555555"; // Cancel action color
        noButton.cornerRadius = 5;
        noButton.onPointerUpObservable.add(() => {
            this.guiTexture.removeControl(dialogContainer); // Dispose container
        });
        buttonsPanel.addControl(noButton);
    }

    public getScene(): Scene { return this.scene; }
    public dispose(): void {
        console.log("Disposing SettingsScene");
        this.guiTexture?.dispose();
        this.scene.dispose();
    }
}
