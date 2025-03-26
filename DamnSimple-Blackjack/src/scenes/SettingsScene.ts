// src/scenes/settingsscene-ts (Added dispose method)
import { Scene, Engine, Vector3, HemisphericLight, Color3, Color4, ArcRotateCamera } from "@babylonjs/core";
import { AdvancedDynamicTexture, Button, TextBlock, StackPanel, Control, Rectangle } from "@babylonjs/gui"; // Import Rectangle

export class SettingsScene {
    private scene: Scene;
    private guiTexture!: AdvancedDynamicTexture;

    constructor(
        engine: Engine,
        canvas: HTMLCanvasElement,
        onBack: () => void,
        onResetFunds: () => void,
        onLanguageChange: (lang: string) => void,
        onCurrencyChange: (currency: string) => void
    ) {
        this.scene = new Scene(engine);

        // Set background color
        this.scene.clearColor = new Color4(0.05, 0.1, 0.15, 1.0); // Slightly different color

        // Create camera
        const camera = new ArcRotateCamera("settingsCamera", -Math.PI / 2, Math.PI / 2, 5, Vector3.Zero(), this.scene);
        // camera.attachControl(canvas, false); // No camera control needed

        // Create light
        const light = new HemisphericLight("settingsLight", new Vector3(0, 1, 0), this.scene);
        light.intensity = 0.8;

        // Create GUI
        this.createGUI(onBack, onResetFunds, onLanguageChange, onCurrencyChange);
    }

    private createGUI(
        onBack: () => void,
        onResetFunds: () => void,
        onLanguageChange: (lang: string) => void,
        onCurrencyChange: (currency: string) => void
    ): void {
        this.guiTexture = AdvancedDynamicTexture.CreateFullscreenUI("SettingsUI", true, this.scene);

        // Main panel
        const panel = new StackPanel("settingsPanel");
        panel.width = "450px"; // Slightly wider
        panel.paddingTop = "20px";
        panel.paddingBottom = "20px";
        panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        panel.background = "rgba(0, 0, 0, 0.5)"; // Semi-transparent background
        panel.cornerRadius = 10;
        this.guiTexture.addControl(panel);

        // Title
        const titleText = new TextBlock("settingsTitle", "Settings");
        titleText.color = "white";
        titleText.fontSize = 32; // Slightly smaller title
        titleText.height = "60px";
        panel.addControl(titleText);

        // --- Language ---
        this.createSectionTitle(panel, "Language");
        const languagePanel = new StackPanel("languagePanel");
        languagePanel.isVertical = false;
        languagePanel.height = "50px";
        languagePanel.spacing = 15; // Add spacing between buttons
        panel.addControl(languagePanel);

        const languages = ["English", "Spanish", "French"]; // Example languages
        languages.forEach(lang => {
            const langButton = this.createOptionButton(`${lang}Button`, lang, () => {
                onLanguageChange(lang.toLowerCase());
                // Add visual feedback (e.g., change button style) - Optional
            });
            languagePanel.addControl(langButton);
        });

         // --- Currency ---
         this.createSectionTitle(panel, "Currency");
         const currencyPanel = new StackPanel("currencyPanel");
         currencyPanel.isVertical = false;
         currencyPanel.height = "50px";
         currencyPanel.spacing = 15;
         panel.addControl(currencyPanel);

         const currencies = ["$", "€", "£", "¥"]; // Example currencies
         currencies.forEach(currency => {
             const currencyButton = this.createOptionButton(`${currency}Button`, currency, () => {
                 onCurrencyChange(currency);
             });
             currencyButton.width = "60px"; // Smaller currency buttons
             currencyPanel.addControl(currencyButton);
         });

        // Spacer
        this.createSpacer(panel, "20px");

        // --- Reset Funds ---
        const resetFundsButton = Button.CreateSimpleButton("resetFundsButton", "Reset Funds");
        resetFundsButton.width = "200px";
        resetFundsButton.height = "50px";
        resetFundsButton.color = "white";
        resetFundsButton.background = "orange"; // Warning color
        resetFundsButton.cornerRadius = 8;
        resetFundsButton.onPointerUpObservable.add(() => {
            this.showConfirmDialog("Are you sure you want to reset your funds?", onResetFunds);
        });
        panel.addControl(resetFundsButton);

        // Spacer
        this.createSpacer(panel, "30px");

        // --- Back Button ---
        const backButton = Button.CreateSimpleButton("backButton", "Back to Game");
        backButton.width = "200px";
        backButton.height = "50px";
        backButton.color = "white";
        backButton.background = "cornflowerblue"; // Softer blue
        backButton.cornerRadius = 8;
        backButton.onPointerUpObservable.add(() => {
            onBack();
        });
        panel.addControl(backButton);
    }

    // Helper for section titles
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

     // Helper for option buttons
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


    // Helper for spacers
    private createSpacer(parent: StackPanel, height: string): void {
        const spacer = new Control(); // Use Control for pure spacing
        spacer.height = height;
        parent.addControl(spacer);
    }

    /** Shows a confirmation dialog */
    private showConfirmDialog(message: string, onConfirm: () => void): void {
        // Container for the dialog + overlay
        const dialogContainer = new Rectangle("confirmDialogContainer");
        dialogContainer.width = 1.0; // Fullscreen
        dialogContainer.height = 1.0;
        dialogContainer.background = "rgba(0, 0, 0, 0.7)"; // Dark overlay
        dialogContainer.zIndex = 100; // Ensure it's on top
        this.guiTexture.addControl(dialogContainer);

        // Dialog panel
        const dialogPanel = new StackPanel("confirmDialogPanel");
        dialogPanel.width = "400px";
        // dialogPanel.height = "180px"; // Auto height based on content
        dialogPanel.paddingTop = "20px";
        dialogPanel.paddingBottom = "20px";
        dialogPanel.paddingLeft = "15px";
        dialogPanel.paddingRight = "15px";
        dialogPanel.background = "#444444"; // Dark gray
        dialogPanel.cornerRadius = 10;
        dialogPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        dialogContainer.addControl(dialogPanel);

        // Dialog text
        const dialogText = new TextBlock("confirmText", message);
        dialogText.color = "white";
        dialogText.fontSize = 18;
        dialogText.height = "80px";
        dialogText.textWrapping = true;
        dialogPanel.addControl(dialogText);

        // Buttons panel
        const buttonsPanel = new StackPanel("confirmButtonsPanel");
        buttonsPanel.isVertical = false;
        buttonsPanel.height = "50px";
        buttonsPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        buttonsPanel.spacing = 20;
        dialogPanel.addControl(buttonsPanel);

        // Yes button
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

        // No button
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

    public getScene(): Scene {
        return this.scene;
    }

     /**
      * Disposes of the scene and its resources.
      */
     public dispose(): void {
         console.log("Disposing SettingsScene");
         this.guiTexture?.dispose();
         this.scene.dispose();
     }
}
