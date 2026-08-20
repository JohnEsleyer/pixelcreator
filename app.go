package main

import (
	"context"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	_ "image/gif"
	_ "image/jpeg"
	"image/png"
	"math"
	"os"
	"strings"
	"time"

	"pixelcreator/models"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx        context.Context
	projects   []models.Project
	worldScene models.WorldScene
	nextID     int
}

func NewApp() *App {
	app := &App{
		projects:   make([]models.Project, 0),
		worldScene: models.NewWorldScene("world-default", "Prototype World", 960, 540),
		nextID:     1,
	}

	sample := models.NewProject(app.nextID, "Hero Sprite", 16, 16)
	app.nextID++

	for y := 4; y < 12; y++ {
		for x := 4; x < 12; x++ {
			sample.Frames[0].Pixels[y*16+x] = &models.Color{R: 0.9, G: 0.7, B: 0.2, A: 1.0}
		}
	}
	sample.Frames[0].Pixels[6*16+6] = &models.Color{R: 0, G: 0, B: 0, A: 1.0}
	sample.Frames[0].Pixels[6*16+9] = &models.Color{R: 0, G: 0, B: 0, A: 1.0}
	for x := 6; x <= 9; x++ {
		sample.Frames[0].Pixels[9*16+x] = &models.Color{R: 0.8, G: 0.2, B: 0.2, A: 1.0}
	}

	// Add sample background asset project
	bgSample := models.NewProject(app.nextID, "World Background", 320, 180)
	app.nextID++
	for y := 0; y < 180; y++ {
		for x := 0; x < 320; x++ {
			if y > 120 {
				bgSample.Frames[0].Pixels[y*320+x] = &models.Color{R: 0.2, G: 0.6, B: 0.3, A: 1.0}
			} else {
				bgSample.Frames[0].Pixels[y*320+x] = &models.Color{R: 0.15, G: 0.2, B: 0.35, A: 1.0}
			}
		}
	}

	app.projects = append(app.projects, sample, bgSample)

	// Add initial entities to world scene
	app.worldScene.Entities = append(app.worldScene.Entities,
		models.WorldEntity{
			ID:            "entity-bg-1",
			ProjectID:     bgSample.ID,
			Name:          bgSample.Name,
			X:             160,
			Y:             90,
			ZIndex:        0,
			ActiveGroupID: bgSample.Groups[0].ID,
			Scale:         1.0,
			Opacity:       1.0,
			Playing:       true,
		},
		models.WorldEntity{
			ID:            "entity-hero-1",
			ProjectID:     sample.ID,
			Name:          sample.Name,
			X:             240,
			Y:             130,
			ZIndex:        1,
			ActiveGroupID: sample.Groups[0].ID,
			Scale:         3.0,
			Opacity:       1.0,
			Playing:       true,
		},
	)

	return app
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) GetProjects() []models.Project {
	return a.projects
}

func (a *App) SaveProject(project models.Project) {
	for i, p := range a.projects {
		if p.ID == project.ID {
			a.projects[i] = project
			return
		}
	}
}

func (a *App) CreateProject(name string, width, height int) models.Project {
	if name == "" {
		name = fmt.Sprintf("Project #%d", a.nextID)
	}
	if width <= 0 {
		width = 16
	}
	if height <= 0 {
		height = width
	}
	proj := models.NewProject(a.nextID, name, width, height)
	a.nextID++
	a.projects = append(a.projects, proj)
	return proj
}

func (a *App) DeleteProject(id int) bool {
	for i, p := range a.projects {
		if p.ID == id {
			a.projects = append(a.projects[:i], a.projects[i+1:]...)
			return true
		}
	}
	return false
}

// --- World Scene Persistence & RON/JSON Generation ---

func (a *App) GetWorldScene() models.WorldScene {
	return a.worldScene
}

func (a *App) SaveWorldScene(scene models.WorldScene) {
	a.worldScene = scene
}

func (a *App) GenerateWorldJSON(scene models.WorldScene) (string, error) {
	data, err := json.MarshalIndent(scene, "", "  ")
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (a *App) GenerateWorldRON(scene models.WorldScene) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("WorldScene(\n"))
	sb.WriteString(fmt.Sprintf("    id: \"%s\",\n", scene.ID))
	sb.WriteString(fmt.Sprintf("    name: \"%s\",\n", scene.Name))
	sb.WriteString(fmt.Sprintf("    dimensions: (%d, %d),\n", scene.Width, scene.Height))
	sb.WriteString(fmt.Sprintf("    bg_color: \"%s\",\n", scene.BgColor))
	sb.WriteString(fmt.Sprintf("    entities: [\n"))

	for _, e := range scene.Entities {
		sb.WriteString(fmt.Sprintf("        WorldEntity(\n"))
		sb.WriteString(fmt.Sprintf("            id: \"%s\",\n", e.ID))
		sb.WriteString(fmt.Sprintf("            project_id: %d,\n", e.ProjectID))
		sb.WriteString(fmt.Sprintf("            name: \"%s\",\n", e.Name))
		sb.WriteString(fmt.Sprintf("            position: (%.2f, %.2f),\n", e.X, e.Y))
		sb.WriteString(fmt.Sprintf("            z_index: %d,\n", e.ZIndex))
		sb.WriteString(fmt.Sprintf("            active_group_id: \"%s\",\n", e.ActiveGroupID))
		sb.WriteString(fmt.Sprintf("            scale: %.2f,\n", e.Scale))
		sb.WriteString(fmt.Sprintf("            flip_x: %t,\n", e.FlipX))
		sb.WriteString(fmt.Sprintf("            flip_y: %t,\n", e.FlipY))
		sb.WriteString(fmt.Sprintf("            opacity: %.2f,\n", e.Opacity))
		sb.WriteString(fmt.Sprintf("        ),\n"))
	}

	sb.WriteString(fmt.Sprintf("    ],\n)"))
	return sb.String()
}

func (a *App) ExportWorldToFile(content string, defaultName string) (string, error) {
	savePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Export World Data",
		DefaultFilename: defaultName,
	})
	if err != nil || savePath == "" {
		return "", fmt.Errorf("export cancelled")
	}

	err = os.WriteFile(savePath, []byte(content), 0644)
	if err != nil {
		return "", err
	}
	return savePath, nil
}

func (a *App) ImportImageAsProject() (*models.Project, error) {
	filePath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Import Image as Project",
		Filters: []runtime.FileFilter{
			{DisplayName: "Images (*.png, *.jpg, *.jpeg)", Pattern: "*.png;*.jpg;*.jpeg"},
		},
	})
	if err != nil || filePath == "" {
		return nil, fmt.Errorf("no file selected")
	}

	imgFile, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer imgFile.Close()

	srcImg, _, err := image.Decode(imgFile)
	if err != nil {
		return nil, err
	}

	bounds := srcImg.Bounds()
	w, h := bounds.Dx(), bounds.Dy()

	proj := models.NewProject(a.nextID, "Imported Image", w, h)
	a.nextID++

	frame := &proj.Frames[0]
	frame.Pixels = make([]*models.Color, w*h)
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			r, g, b, a8 := srcImg.At(x+bounds.Min.X, y+bounds.Min.Y).RGBA()
			if a8 > 0x0800 {
				frame.Pixels[y*w+x] = &models.Color{
					R: float32(r) / 65535.0,
					G: float32(g) / 65535.0,
					B: float32(b) / 65535.0,
					A: float32(a8) / 65535.0,
				}
			}
		}
	}

	a.projects = append(a.projects, proj)
	return &proj, nil
}

func (a *App) ImportImageToFrame(projectID int) (*models.PixelFrame, error) {
	var proj *models.Project
	for i := range a.projects {
		if a.projects[i].ID == projectID {
			proj = &a.projects[i]
			break
		}
	}
	if proj == nil {
		return nil, fmt.Errorf("project not found")
	}

	filePath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Import Image Frame",
		Filters: []runtime.FileFilter{
			{DisplayName: "Images (*.png, *.jpg, *.jpeg)", Pattern: "*.png;*.jpg;*.jpeg"},
		},
	})
	if err != nil || filePath == "" {
		return nil, fmt.Errorf("no file selected")
	}

	imgFile, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer imgFile.Close()

	srcImg, _, err := image.Decode(imgFile)
	if err != nil {
		return nil, err
	}

	bounds := srcImg.Bounds()
	srcW, srcH := bounds.Dx(), bounds.Dy()
	targetW, targetH := proj.Width, proj.Height

	frameID := fmt.Sprintf("frame-imported-%d", time.Now().UnixMilli())
	frame := models.NewPixelFrame(frameID, targetW, targetH, proj.ActiveGroupID)

	for y := 0; y < targetH && y < srcH; y++ {
		for x := 0; x < targetW && x < srcW; x++ {
			r, g, b, a8 := srcImg.At(x+bounds.Min.X, y+bounds.Min.Y).RGBA()
			if a8 > 0x0800 {
				frame.Pixels[y*targetW+x] = &models.Color{
					R: float32(r) / 65535.0,
					G: float32(g) / 65535.0,
					B: float32(b) / 65535.0,
					A: float32(a8) / 65535.0,
				}
			}
		}
	}

	return &frame, nil
}

func (a *App) ExportFrameAsPNG(frame models.PixelFrame, scale int) (string, error) {
	if scale < 1 {
		scale = 1
	}

	savePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Export Frame as PNG",
		DefaultFilename: "pixel_art.png",
		Filters: []runtime.FileFilter{
			{DisplayName: "PNG Image (*.png)", Pattern: "*.png"},
		},
	})
	if err != nil || savePath == "" {
		return "", fmt.Errorf("export cancelled")
	}

	imgW, imgH := frame.Width*scale, frame.Height*scale
	img := image.NewRGBA(image.Rect(0, 0, imgW, imgH))

	for y := 0; y < frame.Height; y++ {
		for x := 0; x < frame.Width; x++ {
			px := frame.Pixels[y*frame.Width+x]
			var c color.Color = color.RGBA{R: 0, G: 0, B: 0, A: 0}
			if px != nil {
				c = color.RGBA{
					R: uint8(px.R * 255.0),
					G: uint8(px.G * 255.0),
					B: uint8(px.B * 255.0),
					A: uint8(px.A * 255.0),
				}
			}
			subRect := image.Rect(x*scale, y*scale, (x+1)*scale, (y+1)*scale)
			draw.Draw(img, subRect, &image.Uniform{C: c}, image.Point{}, draw.Src)
		}
	}

	outFile, err := os.Create(savePath)
	if err != nil {
		return "", err
	}
	defer outFile.Close()

	if err := png.Encode(outFile, img); err != nil {
		return "", err
	}

	return savePath, nil
}

func (a *App) LoadSpriteSheet() (*models.PixelFrame, error) {
	filePath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Load Sprite Sheet Image",
		Filters: []runtime.FileFilter{
			{DisplayName: "Images (*.png, *.jpg, *.jpeg, *.webp)", Pattern: "*.png;*.jpg;*.jpeg;*.webp"},
		},
	})
	if err != nil || filePath == "" {
		return nil, fmt.Errorf("no file selected")
	}

	imgFile, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer imgFile.Close()

	srcImg, _, err := image.Decode(imgFile)
	if err != nil {
		return nil, err
	}

	bounds := srcImg.Bounds()
	w, h := bounds.Dx(), bounds.Dy()

	frameID := fmt.Sprintf("sheet-%d", time.Now().UnixMilli())
	frame := models.NewPixelFrame(frameID, w, h, "")
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			r, g, b, a8 := srcImg.At(x+bounds.Min.X, y+bounds.Min.Y).RGBA()
			if a8 > 0x0800 {
				frame.Pixels[y*w+x] = &models.Color{
					R: float32(r) / 65535.0,
					G: float32(g) / 65535.0,
					B: float32(b) / 65535.0,
					A: float32(a8) / 65535.0,
				}
			}
		}
	}

	return &frame, nil
}

func (a *App) GenerateSampleSpriteSheet() models.PixelFrame {
	frameID := fmt.Sprintf("sample-%d", time.Now().UnixMilli())
	sheet := models.NewPixelFrame(frameID, 128, 128, "")

	for y := 12; y < 52; y++ {
		for x := 12; x < 52; x++ {
			dx := math.Pow(float64(x-32), 2)
			dy := math.Pow(float64(y-32), 2)
			if dx+dy <= 320.0 {
				sheet.Pixels[y*128+x] = &models.Color{R: 0.9, G: 0.2, B: 0.2, A: 1.0}
			}
		}
	}
	for y := 8; y < 56; y++ {
		for x := 72; x < 120; x++ {
			dx := math.Pow(float64(x-96), 2)
			dy := math.Pow(float64(y-32), 2)
			if dx+dy <= 400.0 {
				sheet.Pixels[y*128+x] = &models.Color{R: 0.2, G: 0.8, B: 0.2, A: 1.0}
			}
		}
	}
	for y := 72; y < 120; y++ {
		for x := 8; x < 56; x++ {
			dist := math.Abs(float64(x-32)) + math.Abs(float64(y-96))
			if dist <= 24 {
				sheet.Pixels[y*128+x] = &models.Color{R: 0.2, G: 0.4, B: 0.9, A: 1.0}
			}
		}
	}
	for y := 72; y < 120; y++ {
		for x := 72; x < 120; x++ {
			dx := math.Abs(float64(x - 96))
			dy := math.Abs(float64(y - 96))
			if dx <= 6 || dy <= 6 || (dx == dy && dx <= 18) {
				sheet.Pixels[y*128+x] = &models.Color{R: 0.9, G: 0.8, B: 0.2, A: 1.0}
			}
		}
	}

	return sheet
}

type PackResult struct {
	Sheet      models.PixelFrame        `json:"sheet"`
	Selections []models.SpriteSelection `json:"selections"`
}

func (a *App) PackFramesToSheet(proj models.Project) PackResult {
	numFrames := len(proj.Frames)
	if numFrames == 0 {
		frameID := fmt.Sprintf("empty-%d", time.Now().UnixMilli())
		return PackResult{Sheet: models.NewPixelFrame(frameID, 128, 128, ""), Selections: nil}
	}

	cols := int(math.Ceil(math.Sqrt(float64(numFrames))))
	rows := int(math.Ceil(float64(numFrames) / float64(cols)))

	sheetW := proj.Width * cols
	sheetH := proj.Height * rows

	sheetID := fmt.Sprintf("packed-%d", time.Now().UnixMilli())
	sheet := models.NewPixelFrame(sheetID, sheetW, sheetH, "")
	selections := make([]models.SpriteSelection, 0, numFrames)

	for i, frame := range proj.Frames {
		c := i % cols
		r := i / cols

		startX := c * proj.Width
		startY := r * proj.Height

		for y := 0; y < proj.Height; y++ {
			for x := 0; x < proj.Width; x++ {
				if y*proj.Width+x < len(frame.Pixels) {
					px := frame.Pixels[y*proj.Width+x]
					if px != nil {
						sheet.Pixels[(startY+y)*sheetW+(startX+x)] = px
					}
				}
			}
		}

		groupName := "Main"
		for _, g := range proj.Groups {
			if g.ID == frame.GroupID {
				groupName = g.Name
				break
			}
		}

		selections = append(selections, models.SpriteSelection{
			ID:        i + 1,
			X:         startX,
			Y:         startY,
			Width:     proj.Width,
			Height:    proj.Height,
			GroupName: groupName,
			Enabled:   true,
		})
	}

	return PackResult{Sheet: sheet, Selections: selections}
}
