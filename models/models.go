package models

type Color struct {
	R float32 `json:"r"`
	G float32 `json:"g"`
	B float32 `json:"b"`
	A float32 `json:"a"`
}

type Group struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"` // Hex color code
}

type PixelFrame struct {
	ID      string   `json:"id"`
	Width   int      `json:"width"`
	Height  int      `json:"height"`
	Pixels  []*Color `json:"pixels"`
	GroupID string   `json:"groupId"`
}

func NewPixelFrame(id string, w, h int, groupID string) PixelFrame {
	return PixelFrame{
		ID:      id,
		Width:   w,
		Height:  h,
		Pixels:  make([]*Color, w*h),
		GroupID: groupID,
	}
}

type SelectionGroup struct {
	Name  string `json:"name"`
	Color string `json:"color"` // Hex color code e.g. "#e63946"
}

type SpriteSelection struct {
	ID        int    `json:"id"`
	X         int    `json:"x"`
	Y         int    `json:"y"`
	Width     int    `json:"width"`
	Height    int    `json:"height"`
	GroupName string `json:"groupName"`
	Enabled   bool   `json:"enabled"`
}

type Project struct {
	ID                       int          `json:"id"`
	Name                     string       `json:"name"`
	Width                    int          `json:"width"`
	Height                   int          `json:"height"`
	Groups                   []Group      `json:"groups"`
	Frames                   []PixelFrame `json:"frames"`
	ActiveGroupID            string       `json:"activeGroupId"`
	CurrentFrameIndexInGroup int          `json:"currentFrameIndexInGroup"`
	FPS                      int          `json:"fps"`
	OnionSkinEnabled         bool         `json:"onionSkinEnabled"`
	Zoom                     float32      `json:"zoom"`
}

func NewProject(id int, name string, w, h int) Project {
	defaultGroup := Group{
		ID:    "group-idle",
		Name:  "Idle",
		Color: "#e63946",
	}

	defaultFrame := NewPixelFrame("frame-1", w, h, defaultGroup.ID)

	return Project{
		ID:                       id,
		Name:                     name,
		Width:                    w,
		Height:                   h,
		Groups:                   []Group{defaultGroup},
		Frames:                   []PixelFrame{defaultFrame},
		ActiveGroupID:            defaultGroup.ID,
		CurrentFrameIndexInGroup: 0,
		FPS:                      8,
		OnionSkinEnabled:         true,
		Zoom:                     1.0,
	}
}
