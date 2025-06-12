// src/scenes/settingsscene-ts
import { Scene, Engine, Vector3, HemisphericLight, Color4, ArcRotateCamera } from "@babylonjs/core";
import { AdvancedDynamicTexture, Button, TextBlock, StackPanel, Control, Rectangle } from "@babylonjs/gui";
import { QualityLevel, QualitySettings, UIScaleLevel, UIScaleSettings, UI_IDEAL_WIDTH, UI_IDEAL_HEIGHT } from "../Constants";
import { ConfirmDialog } from "../ui/factories/DialogFactory";

export class SettingsScene {
    private scene: Scene;
    private engine: Engine;
    private guiTexture!: AdvancedDynamicTexture;
    private qualityButtons: Map<QualityLevel, Button> = new Map();
    private uiScaleButtons: Map<UIScaleLevel, Button> = new Map();

    constructor(
        engine: Engine,
        canvasElement: HTMLCanvasElement,
        onBack: () => void,
        onResetFunds: () => void, onLanguageChange: (lang: string) => void,
        onCurrencyChange: (currency: string) => void,
        onQualityChange: (level: QualityLevel) => void,
        currentQuality: QualityLevel,
        onUIScaleChange: (level: UIScaleLevel) => void,
        currentUIScale: UIScaleLevel
    ) {
        this.scene = new Scene(engine);
        this.engine = engine;
        this.scene.clearColor = new Color4(0.05, 0.1, 0.15, 1.0);
        const camera = new ArcRotateCamera("settingsCamera", -Math.PI / 2, Math.PI / 2, 5, Vector3.Zero(), this.scene);
        const light = new HemisphericLight("settingsLight", new Vector3(0, 1, 0), this.scene);
        light.intensity = 0.8;

        this.createGUI(onBack, onResetFunds, onLanguageChange, onCurrencyChange, onQualityChange, currentQuality, onUIScaleChange, currentUIScale);
    }

    private createGUI(
        onBack: () => void, onResetFunds: () => void,
        onLanguageChange: (lang: string) => void, onCurrencyChange: (currency: string) => void,
        onQualityChange: (level: QualityLevel) => void,
        currentQuality: QualityLevel,
        onUIScaleChange: (level: UIScaleLevel) => void,
        currentUIScale: UIScaleLevel
    ): void {
        // Create UI texture
        this.guiTexture = AdvancedDynamicTexture.CreateFullscreenUI(
            "SettingsUI",
            true, // foreground
            this.scene
        );
        // Set initial ideal dimensions based on the current scale from the main game
        const initialScaleFactor = UIScaleSettings[currentUIScale].scale;
        this.guiTexture.idealWidth = UI_IDEAL_WIDTH / initialScaleFactor;
        this.guiTexture.idealHeight = UI_IDEAL_HEIGHT / initialScaleFactor;
        // When false, ideal dimensions are used to scale controls, which is what we want.
        this.guiTexture.renderAtIdealSize = false;
        console.log(`[SettingsScene] Initialized GUI. Initial ideal dimensions: ${this.guiTexture.idealWidth.toFixed(0)}x${this.guiTexture.idealHeight.toFixed(0)}. renderAtIdealSize: false.`);

        const panelContainer = new Rectangle("settingsPanelContainer");
        panelContainer.width = "480px";
        panelContainer.adaptHeightToChildren = true;
        panelContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        panelContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        panelContainer.background = "rgba(0, 0, 0, 0.6)";
        panelContainer.cornerRadius = 15;
        panelContainer.thickness = 0;
        this.guiTexture.addControl(panelContainer);

        const panel = new StackPanel("settingsPanel");
        panel.paddingTop = "20px"; panel.paddingBottom = "20px";
        panel.paddingLeft = "15px"; panel.paddingRight = "15px";
        panelContainer.addControl(panel);

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
            const qualityButton = this.createOptionButton(`quality${level}Button`, QualitySettings[level].name, () => {
                onQualityChange(level);
                this.updateQualityButtons(level);
            });
            qualityButton.width = "90px";
            this.qualityButtons.set(level, qualityButton);
            qualityPanel.addControl(qualityButton);
        });
        this.updateQualityButtons(currentQuality);

        // --- UI Scale ---
        this.createSectionTitle(panel, "UI Scale");
        const uiScalePanel = new StackPanel("uiScalePanel");
        uiScalePanel.isVertical = false; uiScalePanel.height = "50px"; uiScalePanel.spacing = 10;
        uiScalePanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        panel.addControl(uiScalePanel);
        (Object.keys(UIScaleSettings) as UIScaleLevel[]).forEach(level => {
            const scaleButton = this.createOptionButton(`uiScale${level}Button`, UIScaleSettings[level].name, () => {
                // This call informs the main game class to save the setting
                onUIScaleChange(level);
                // We also update the settings scene's own UI scale immediately
                const scaleFactor = UIScaleSettings[level].scale;
                this.guiTexture.idealWidth = UI_IDEAL_WIDTH / scaleFactor;
                this.guiTexture.idealHeight = UI_IDEAL_HEIGHT / scaleFactor;
                console.log(`[SettingsScene] UI Scale button clicked. New ideal dimensions: ${this.guiTexture.idealWidth.toFixed(0)}x${this.guiTexture.idealHeight.toFixed(0)}`);
                this.updateUIScaleButtons(level);
            });
            scaleButton.width = "90px";
            this.uiScaleButtons.set(level, scaleButton);
            uiScalePanel.addControl(scaleButton);
        });
        this.updateUIScaleButtons(currentUIScale);


        // --- Language ---
        this.createSectionTitle(panel, "Language");
        const languagePanel = new StackPanel("languagePanel");
        languagePanel.isVertical = false; languagePanel.height = "50px"; languagePanel.spacing = 15;
        languagePanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        panel.addControl(languagePanel);
        const languages = ["English", "Spanish", "French"];
        languages.forEach(lang => {
            const langButton = this.createOptionButton(`${lang}Button`, lang, () => onLanguageChange(lang.toLowerCase()));
            languagePanel.addControl(langButton);
        });

        // --- Currency ---
        this.createSectionTitle(panel, "Currency");
        const currencyPanel = new StackPanel("currencyPanel");
        currencyPanel.isVertical = false; currencyPanel.height = "50px"; currencyPanel.spacing = 15;
        currencyPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        panel.addControl(currencyPanel);
        const currencies = ["$", "€", "£", "¥"];
        currencies.forEach(currency => {
            const currencyButton = this.createOptionButton(`${currency}Button`, currency, () => onCurrencyChange(currency));
            currencyButton.width = "60px";
            currencyPanel.addControl(currencyButton);
        });

        this.createSpacer(panel, "20px");

        const resetFundsButton = Button.CreateSimpleButton("resetFundsButton", "Reset Funds");
        resetFundsButton.width = "200px"; resetFundsButton.height = "50px"; resetFundsButton.color = "white";
        resetFundsButton.background = "orange"; resetFundsButton.cornerRadius = 8;
        resetFundsButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        resetFundsButton.onPointerUpObservable.add(() => {
            ConfirmDialog.show(this.guiTexture, "Are you sure you want to reset your funds to the default amount?", onResetFunds);
        });
        panel.addControl(resetFundsButton);

        this.createSpacer(panel, "30px");

        const backButton = Button.CreateSimpleButton("backButton", "Back to Game");
        backButton.width = "200px"; backButton.height = "50px"; backButton.color = "white";
        backButton.background = "cornflowerblue"; backButton.cornerRadius = 8;
        backButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        backButton.onPointerUpObservable.add(onBack);
        panel.addControl(backButton);
    }

    private createSectionTitle(parent: StackPanel, text: string): void {
        const title = new TextBlock();
        title.text = text;
        title.color = "#CCCCCC";
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
        button.background = "darkgreen";
        button.cornerRadius = 5;
        button.onPointerUpObservable.add(onClick);
        return button;
    }

    private updateQualityButtons(activeLevel: QualityLevel): void {
        this.qualityButtons.forEach((button, level) => {
            const isActive = level === activeLevel;
            button.isEnabled = !isActive;
            button.alpha = isActive ? 0.6 : 1.0;
            button.background = isActive ? "gray" : "darkgreen";
        });
    }

    private updateUIScaleButtons(activeLevel: UIScaleLevel): void {
        this.uiScaleButtons.forEach((button, level) => {
            const isActive = level === activeLevel;
            button.isEnabled = !isActive;
            button.alpha = isActive ? 0.6 : 1.0;
            button.background = isActive ? "gray" : "darkgreen";
        });
    }

    private createSpacer(parent: StackPanel, height: string): void {
        const spacer = new Control();
        spacer.height = height;
        parent.addControl(spacer);
    }

    public getScene(): Scene { return this.scene; }
    public dispose(): void {
        console.log("Disposing SettingsScene");
        this.guiTexture?.dispose();
        this.scene.dispose();
    }
}
