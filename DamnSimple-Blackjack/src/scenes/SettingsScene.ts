// scenes/SettingsScene.ts
import { Scene, Engine, Vector3, HemisphericLight, Color3, Color4, ArcRotateCamera } from "@babylonjs/core";
import { AdvancedDynamicTexture, Button, TextBlock, StackPanel, Control } from "@babylonjs/gui";

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
        this.scene.clearColor = new Color4(0.05, 0.2, 0.05);
        
        // Create camera
        const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2, 5, Vector3.Zero(), this.scene);
        camera.attachControl(canvas, true);
        
        // Create light
        const light = new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);
        
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
        const panel = new StackPanel();
        panel.width = "400px";
        panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        this.guiTexture.addControl(panel);
        
        // Title
        const titleText = new TextBlock();
        titleText.text = "Settings";
        titleText.color = "white";
        titleText.fontSize = 36;
        titleText.height = "70px";
        panel.addControl(titleText);
        
        // Language selection
        const languageTitle = new TextBlock();
        languageTitle.text = "Language";
        languageTitle.color = "white";
        languageTitle.fontSize = 24;
        languageTitle.height = "50px";
        panel.addControl(languageTitle);
        
        // Language buttons
        const languagePanel = new StackPanel();
        languagePanel.isVertical = false;
        languagePanel.height = "50px";
        panel.addControl(languagePanel);
        
        const languages = ["English", "Spanish", "French"];
        languages.forEach(lang => {
            const langButton = Button.CreateSimpleButton(`${lang}Button`, lang);
            langButton.width = "120px";
            langButton.height = "40px";
            langButton.color = "white";
            langButton.background = "green";
            langButton.onPointerClickObservable.add(() => {
                onLanguageChange(lang.toLowerCase());
            });
            languagePanel.addControl(langButton);
        });
        
        // Currency selection
        const currencyTitle = new TextBlock();
        currencyTitle.text = "Currency";
        currencyTitle.color = "white";
        currencyTitle.fontSize = 24;
        currencyTitle.height = "50px";
        panel.addControl(currencyTitle);
        
        // Currency buttons
        const currencyPanel = new StackPanel();
        currencyPanel.isVertical = false;
        currencyPanel.height = "50px";
        panel.addControl(currencyPanel);
        
        const currencies = ["$", "€", "£", "¥"];
        currencies.forEach(currency => {
            const currencyButton = Button.CreateSimpleButton(`${currency}Button`, currency);
            currencyButton.width = "80px";
            currencyButton.height = "40px";
            currencyButton.color = "white";
            currencyButton.background = "green";
            currencyButton.onPointerClickObservable.add(() => {
                onCurrencyChange(currency);
            });
            currencyPanel.addControl(currencyButton);
        });
        
        // Spacer
        const spacer = new TextBlock();
        spacer.height = "30px";
        panel.addControl(spacer);
        
        // Reset funds button
        const resetFundsButton = Button.CreateSimpleButton("resetFundsButton", "Reset Funds");
        resetFundsButton.width = "200px";
        resetFundsButton.height = "50px";
        resetFundsButton.color = "white";
        resetFundsButton.background = "red";
        resetFundsButton.onPointerClickObservable.add(() => {
            this.showConfirmDialog(onResetFunds);
        });
        panel.addControl(resetFundsButton);
        
        // Spacer
        const spacer2 = new TextBlock();
        spacer2.height = "30px";
        panel.addControl(spacer2);
        
        // Back button
        const backButton = Button.CreateSimpleButton("backButton", "Back to Game");
        backButton.width = "200px";
        backButton.height = "50px";
        backButton.color = "white";
        backButton.background = "blue";
        backButton.onPointerClickObservable.add(() => {
            onBack();
        });
        panel.addControl(backButton);
    }
    
    private showConfirmDialog(onConfirm: () => void): void {
        // Dialog panel
        const dialogPanel = new StackPanel();
        dialogPanel.width = "400px";
        dialogPanel.height = "200px";
        dialogPanel.background = "gray";
        dialogPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        dialogPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        this.guiTexture.addControl(dialogPanel);
        
        // Dialog text
        const dialogText = new TextBlock();
        dialogText.text = "Are you sure you want to reset your funds?";
        dialogText.color = "white";
        dialogText.fontSize = 20;
        dialogText.height = "80px";
        dialogPanel.addControl(dialogText);
        
        // Buttons panel
        const buttonsPanel = new StackPanel();
        buttonsPanel.isVertical = false;
        buttonsPanel.height = "50px";
        dialogPanel.addControl(buttonsPanel);
        
        // Yes button
        const yesButton = Button.CreateSimpleButton("yesButton", "Yes");
        yesButton.width = "100px";
        yesButton.height = "40px";
        yesButton.color = "white";
        yesButton.background = "green";
        yesButton.onPointerClickObservable.add(() => {
            onConfirm();
            this.guiTexture.removeControl(dialogPanel);
        });
        buttonsPanel.addControl(yesButton);
        
        // No button
        const noButton = Button.CreateSimpleButton("noButton", "No");
        noButton.width = "100px";
        noButton.height = "40px";
        noButton.color = "white";
        noButton.background = "red";
        noButton.onPointerClickObservable.add(() => {
            this.guiTexture.removeControl(dialogPanel);
        });
        buttonsPanel.addControl(noButton);
    }
    
    public getScene(): Scene {
        return this.scene;
    }
}
