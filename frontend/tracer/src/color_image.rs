use wasm_bindgen::prelude::*;
use visioncortex::{Color, ColorImage, PathSimplifyMode, PointF64};
use visioncortex::color_clusters::{Clusters, Runner, RunnerConfig, HIERARCHICAL_MAX, IncrementalBuilder, KeyingAction};
use web_sys::ImageData;

use serde::{Deserialize, Serialize};

const KEYING_THRESHOLD: f32 = 0.2;

#[derive(Debug, Deserialize)]
pub struct ColorImageConverterParams {
    pub mode: String,
    pub hierarchical: String,
    pub corner_threshold: f64,
    pub length_threshold: f64,
    pub max_iterations: usize,
    pub splice_threshold: f64,
    pub filter_speckle: usize,
    pub color_precision: i32,
    pub layer_difference: i32,
    pub path_precision: u32,
}

#[derive(Debug, Serialize)]
pub struct PathData {
    pub d: String,
    pub color: ColorData,
    pub offset: PointData,
}

#[derive(Debug, Serialize)]
pub struct ColorData {
    pub r: u8,
    pub g: u8,
    pub b: u8,
}

#[derive(Debug, Serialize)]
pub struct PointData {
    pub x: f64,
    pub y: f64,
}

#[wasm_bindgen]
pub struct ColorImageConverter {
    stage: Stage,
    counter: usize,
    mode: PathSimplifyMode,
    params: ColorImageConverterParams,
}

pub enum Stage {
    New,
    Clustering(IncrementalBuilder),
    Reclustering(IncrementalBuilder),
    Vectorize(Clusters),
}

impl ColorImageConverter {
    pub fn new(params: ColorImageConverterParams) -> Self {
        Self {
            stage: Stage::New,
            counter: 0,
            mode: Self::path_simplify_mode(&params.mode),
            params,
        }
    }

    fn path_simplify_mode(mode: &str) -> PathSimplifyMode {
        match mode {
            "polygon" => PathSimplifyMode::Polygon,
            "spline" => PathSimplifyMode::Spline,
            "none" => PathSimplifyMode::None,
            _ => PathSimplifyMode::Polygon,
        }
    }
}

#[wasm_bindgen]
impl ColorImageConverter {

    pub fn new_with_string(params: String) -> Self {
        let params: ColorImageConverterParams = serde_json::from_str(params.as_str()).unwrap();
        Self::new(params)
    }

    pub fn init(&mut self, image_data: ImageData) -> Result<(), JsValue> {
        let width = image_data.width() as usize;
        let height = image_data.height() as usize;

        let data = image_data.data();

        let mut image = ColorImage {
            pixels: data.to_vec(),
            width,
            height,
        };

        let key_color = if Self::should_key_image(&image) {
            if let Ok(key_color) = Self::find_unused_color_in_image(&image) {
                for y in 0..height {
                    for x in 0..width {
                        if image.get_pixel(x, y).a == 0 {
                            image.set_pixel(x, y, &key_color);
                        }
                    }
                }
                key_color
            } else {
                Color::default()
            }
        } else {
            Color::default()
        };

        let runner = Runner::new(RunnerConfig {
            diagonal: self.params.layer_difference == 0,
            hierarchical: HIERARCHICAL_MAX,
            batch_size: 25600,
            good_min_area: self.params.filter_speckle,
            good_max_area: (width * height) as usize,
            is_same_color_a: self.params.color_precision,
            is_same_color_b: 1,
            deepen_diff: self.params.layer_difference,
            hollow_neighbours: 1,
            key_color,
            keying_action: if self.params.hierarchical == "cutout" {
                KeyingAction::Keep
            } else {
                KeyingAction::Discard
            },
        }, image);
        self.stage = Stage::Clustering(runner.start());
        Ok(())
    }

    pub fn tick(&mut self) -> Result<Option<String>, JsValue> {
        match &mut self.stage {
            Stage::New => {
                Err(JsValue::from_str("uninitialized"))
            },
            Stage::Clustering(builder) => {
                if builder.tick() {
                    match self.params.hierarchical.as_str() {
                        "stacked" => {
                            self.stage = Stage::Vectorize(builder.result());
                        },
                        "cutout" => {
                            let clusters = builder.result();
                            let view = clusters.view();
                            let image = view.to_color_image();
                            let runner = Runner::new(RunnerConfig {
                                diagonal: false,
                                hierarchical: 64,
                                batch_size: 25600,
                                good_min_area: 0,
                                good_max_area: (image.width * image.height) as usize,
                                is_same_color_a: 0,
                                is_same_color_b: 1,
                                deepen_diff: 0,
                                hollow_neighbours: 0,
                                key_color: Default::default(),
                                keying_action: KeyingAction::Discard,
                            }, image);
                            self.stage = Stage::Reclustering(runner.start());
                        },
                        _ => return Err(JsValue::from_str(&format!("unknown hierarchical `{}`", self.params.hierarchical)))
                    }
                }
                Ok(None)
            },
            Stage::Reclustering(builder) => {
                if builder.tick() {
                    self.stage = Stage::Vectorize(builder.result())
                }
                Ok(None)
            },
            Stage::Vectorize(clusters) => {
                let view = clusters.view();
                if self.counter < view.clusters_output.len() {
                    let cluster = view.get_cluster(view.clusters_output[self.counter]);
                    let paths = cluster.to_compound_path(
                        &view, false, self.mode,
                        self.params.corner_threshold,
                        self.params.length_threshold,
                        self.params.max_iterations,
                        self.params.splice_threshold
                    );

                    let (path_string, offset) = paths.to_svg_string(true, PointF64::default(), Some(self.params.path_precision));
                    let color = cluster.residue_color();

                    let path_data = PathData {
                        d: path_string,
                        color: ColorData {
                            r: color.r,
                            g: color.g,
                            b: color.b,
                        },
                        offset: PointData {
                            x: offset.x,
                            y: offset.y,
                        },
                    };

                    self.counter += 1;
                    Ok(Some(serde_json::to_string(&path_data).unwrap()))
                } else {
                    Ok(Some("complete".to_string()))
                }
            }
        }
    }

    pub fn progress(&self) -> i32 {
        (match &self.stage {
            Stage::New => {
                0
            },
            Stage::Clustering(builder) => {
                builder.progress() / 2
            },
            Stage::Reclustering(_builder) => {
                50
            },
            Stage::Vectorize(clusters) => {
                50 + 50 * self.counter as u32 / clusters.view().clusters_output.len() as u32
            }
        }) as i32
    }

    fn color_exists_in_image(img: &ColorImage, color: Color) -> bool {
        for y in 0..img.height {
            for x in 0..img.width {
                let pixel_color = img.get_pixel(x, y);
                if pixel_color.r == color.r && pixel_color.g == color.g && pixel_color.b == color.b {
                    return true
                }
            }
        }
        false
    }

    fn find_unused_color_in_image(img: &ColorImage) -> Result<Color, String> {
        let special_colors = IntoIterator::into_iter([
            Color::new(255, 0,   0),
            Color::new(0,   255, 0),
            Color::new(0,   0,   255),
            Color::new(255, 255, 0),
            Color::new(0,   255, 255),
            Color::new(255, 0,   255),
            Color::new(128, 128, 128),
        ]);
        for color in special_colors {
            if !Self::color_exists_in_image(img, color) {
                return Ok(color);
            }
        }
        Err(String::from("unable to find unused color in image to use as key"))
    }

    fn should_key_image(img: &ColorImage) -> bool {
        if img.width == 0 || img.height == 0 {
            return false;
        }

        // Check for transparency at several scanlines
        let threshold = ((img.width * 2) as f32 * KEYING_THRESHOLD) as usize;
        let mut num_transparent_pixels = 0;
        let y_positions = [0, img.height / 4, img.height / 2, 3 * img.height / 4, img.height - 1];
        for y in y_positions {
            for x in 0..img.width {
                if img.get_pixel(x, y).a == 0 {
                    num_transparent_pixels += 1;
                }
                if num_transparent_pixels >= threshold {
                    return true;
                }
            }
        }

        false
    }
}
