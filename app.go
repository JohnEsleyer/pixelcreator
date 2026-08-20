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
	ctx      context.Context
	projects []models.Project
	nextID   int
}

func NewApp() *App {
	app := &App{
		projects: make([]models.Project, 0),
		nextID:   1,
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

	app.projects = append(app.projects, sample)

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

// --- Custom Sprite Data Format Serialization & Deserialization ---

func (a *App) ExportSpriteDataJSON(project models.Project) (string, error) {
	fileData := models.SpriteDataFile{
		Format:  "pixelcreator.sprite",
		Version: "1.0",
		Name:    project.Name,
		Width:   project.Width,
		Height:  project.Height,
		FPS:     project.FPS,
		Groups:  project.Groups,
		Frames:  project.Frames,
	}

	bytes, err := json.MarshalIndent(fileData, "", "  ")
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

func (a *App) ExportSpriteDataRON(project models.Project) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("SpriteData(\n"))
	sb.WriteString(fmt.Sprintf("    name: \"%s\",\n", project.Name))
	sb.WriteString(fmt.Sprintf("    dimensions: (%d, %d),\n", project.Width, project.Height))
	sb.WriteString(fmt.Sprintf("    fps: %d,\n", project.FPS))
	sb.WriteString(fmt.Sprintf("    groups_count: %d,\n", len(project.Groups)))
	sb.WriteString(fmt.Sprintf("    frames_count: %d,\n", len(project.Frames)))
	sb.WriteString(fmt.Sprintf(")\n"))
	return sb.String()
}

func (a *App) ImportSpriteData(raw string) (*models.Project, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, fmt.Errorf("empty sprite data")
	}

	var data models.SpriteDataFile
	err := json.Unmarshal([]byte(trimmed), &data)
	if err != nil {
		// Fallback: try parsing as pure Project struct
		var rawProj models.Project
		if err2 := json.Unmarshal([]byte(trimmed), &rawProj); err2 == nil && len(rawProj.Frames) > 0 {
			rawProj.ID = a.nextID
			a.nextID++
			a.projects = append(a.projects, rawProj)
			return &rawProj, nil
		}
		return nil, fmt.Errorf("invalid sprite JSON format: %v", err)
	}

	proj := models.NewProject(a.nextID, data.Name, data.Width, data.Height)
	a.nextID++

	if len(data.Groups) > 0 {
		proj.Groups = data.Groups
		proj.ActiveGroupID = data.Groups[0].ID
	}
	if len(data.Frames) > 0 {
		proj.Frames = data.Frames
	}
	if data.FPS > 0 {
		proj.FPS = data.FPS
	}

	a.projects = append(a.projects, proj)
	return &proj, nil
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
