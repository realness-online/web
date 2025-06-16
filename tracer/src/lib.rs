use wasm_bindgen::prelude::*;
use web_sys::{ImageData, console};
use visioncortex::{
    Color, ColorImage,
    color_clusters::{
        Runner,
        RunnerConfig,
        KeyingAction,
        IncrementalBuilder,
        Clusters,
    },
    BinaryImage,
};

pub fn add(left: u64, right: u64) -> u64 {
    left + right
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let result = add(2, 2);
        assert_eq!(result, 4);
    }
}

#[wasm_bindgen]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
#[derive(Copy, Clone)]
pub struct TraceOptions {
    pub color_count: u32,
    pub min_color_count: u32,
    pub max_color_count: u32,
    pub turd_size: u32,
    pub corner_threshold: f64,
    pub splice_threshold: f64,
    pub color_precision: u32,
    pub path_precision: u32,
    pub force_color_count: bool,
    pub hierarchical: u32,
    pub keep_details: bool,
    pub diagonal: bool,
    pub batch_size: i32,
    pub good_min_area: usize,
    pub good_max_area: usize,
    pub is_same_color_a: i32,
    pub is_same_color_b: i32,
    pub deepen_diff: i32,
    pub hollow_neighbours: usize,
}

#[wasm_bindgen]
impl TraceOptions {
    #[wasm_bindgen(constructor)]
    pub fn new() -> TraceOptions {
        TraceOptions {
            color_count: 32,
            min_color_count: 32,
            max_color_count: 32,
            turd_size: 20,
            corner_threshold: 60.0,
            splice_threshold: 45.0,
            color_precision: 8,
            path_precision: 8,
            force_color_count: true,
            hierarchical: 1,
            keep_details: true,
            diagonal: false,
            batch_size: 25600,
            good_min_area: 16,
            good_max_area: 256 * 256,
            is_same_color_a: 4,
            is_same_color_b: 1,
            deepen_diff: 64,
            hollow_neighbours: 1,
        }
    }
}

pub enum Stage {
    New,
    Clustering(IncrementalBuilder),
    Reclustering(IncrementalBuilder),
    Vectorize(Clusters),
}

#[wasm_bindgen]
pub struct Tracer {
    stage: Stage,
    counter: usize,
    pub options: TraceOptions,
}

#[wasm_bindgen]
impl Tracer {
    #[wasm_bindgen(constructor)]
    pub fn new(options: TraceOptions) -> Self {
        Self {
            stage: Stage::New,
            counter: 0,
            options,
        }
    }

    pub fn init(&mut self, image_data: ImageData) -> Result<(), JsValue> {
        let width = image_data.width() as usize;
        let height = image_data.height() as usize;
        let data = image_data.data();

        console::log_1(&format!("Creating color image: {}x{}", width, height).into());
        console::log_1(&format!("Data length: {}", data.len()).into());

        // Create color image directly from raw data
        console::log_1(&"About to create ColorImage struct".into());
        let mut color_image = ColorImage {
            pixels: data.to_vec(),
            width,
            height,
        };
        console::log_1(&"ColorImage struct created".into());

        // Verify data length matches expected size
        let expected_size = width * height * 4;
        if color_image.pixels.len() != expected_size {
            return Err(JsValue::from_str(&format!(
                "Invalid image data size: {} != {}",
                color_image.pixels.len(),
                expected_size
            )));
        }

        console::log_1(&"Color image created successfully".into());

        // Check for transparency and handle keying
        console::log_1(&"Checking for transparency".into());
        let key_color = if should_key_image(&color_image) {
            console::log_1(&"Image has transparency, finding key color".into());
            if let Ok(key_color) = find_unused_color_in_image(&color_image) {
                console::log_1(&"Found unused color, applying keying".into());
                for y in 0..height {
                    for x in 0..width {
                        if color_image.get_pixel(x, y).a == 0 {
                            color_image.set_pixel(x, y, &key_color);
                        }
                    }
                }
                key_color
            } else {
                console::log_1(&"No unused color found, using default".into());
                Color::default()
            }
        } else {
            console::log_1(&"No transparency detected".into());
            Color::default()
        };

        // First phase: Full hierarchical clustering
        console::log_1(&"Creating RunnerConfig".into());
        console::log_1(&format!("Image dimensions: {}x{}", width, height).into());
        console::log_1(&format!("Batch size: {}", 25600).into());
        console::log_1(&format!("Good min area: {}", self.options.good_min_area).into());
        console::log_1(&format!("Good max area: {}", (width * height) as usize).into());
        console::log_1(&format!("Color precision: {}", self.options.color_precision).into());
        console::log_1(&format!("Deepen diff: {}", self.options.deepen_diff).into());

        let runner_config = RunnerConfig {
            diagonal: self.options.diagonal,
            hierarchical: self.options.hierarchical,
            batch_size: self.options.batch_size,
            good_min_area: self.options.good_min_area,
            good_max_area: self.options.good_max_area,
            is_same_color_a: self.options.is_same_color_a,
            is_same_color_b: self.options.is_same_color_b,
            deepen_diff: self.options.deepen_diff,
            hollow_neighbours: self.options.hollow_neighbours,
            key_color,
            keying_action: KeyingAction::Discard,
        };
        console::log_1(&"RunnerConfig created".into());

        console::log_1(&"About to create Runner".into());
        let runner = Runner::new(runner_config, color_image);
        console::log_1(&"Runner created".into());

        console::log_1(&"About to start clustering".into());
        let builder = runner.start();
        console::log_1(&"Builder created".into());
        self.stage = Stage::Clustering(builder);
        console::log_1(&"Stage set to Clustering".into());

        Ok(())
    }

    pub fn tick(&mut self) -> Result<bool, JsValue> {
        let progress = self.progress();
        match &mut self.stage {
            Stage::New => {
                console::log_1(&format!("Stage: New, Progress: {}%", progress).into());
                Err(JsValue::from_str("uninitialized"))
            },
            Stage::Clustering(builder) => {
                console::log_1(&format!("Stage: Clustering, Progress: {}%", progress).into());
                if builder.tick() {
                    let clusters = builder.result();
                    let view = clusters.view();
                    let image = view.to_color_image();

                    // Second phase: Reclustering
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

                    console::log_1(&"Starting reclustering".into());
                    self.stage = Stage::Reclustering(runner.start());
                }
                Ok(false)
            },
            Stage::Reclustering(builder) => {
                console::log_1(&format!("Stage: Reclustering, Progress: {}%", progress).into());
                if builder.tick() {
                    self.stage = Stage::Vectorize(builder.result());
                }
                Ok(false)
            },
            Stage::Vectorize(clusters) => {
                let view = clusters.view();
                if self.counter < view.clusters_output.len() {
                    console::log_1(&format!("Stage: Vectorize, Progress: {}%, Processing cluster {}/{}",
                        progress,
                        self.counter + 1,
                        view.clusters_output.len()
                    ).into());
                    let cluster = view.get_cluster(view.clusters_output[self.counter]);
                    let color = cluster.residue_color();

                    {
                        let mut binary_image = BinaryImage::new_w_h(view.width as usize, view.height as usize);
                        cluster.render_to_binary_image(&view, &mut binary_image);

                        let spline = visioncortex::Spline::from_image(
                            &binary_image,
                            true,
                            self.options.corner_threshold.to_radians(),
                            1.0,
                            1.0,
                            4,
                            self.options.splice_threshold.to_radians(),
                        );

                        let path_string = spline.to_svg_string(true, &visioncortex::PointF64::default(), Some(self.options.path_precision));

                        let path_obj = js_sys::Object::new();
                        js_sys::Reflect::set(&path_obj, &"path".into(), &JsValue::from_str(&path_string))?;

                        let color_obj = js_sys::Object::new();
                        js_sys::Reflect::set(&color_obj, &"r".into(), &JsValue::from_f64(color.r as f64))?;
                        js_sys::Reflect::set(&color_obj, &"g".into(), &JsValue::from_f64(color.g as f64))?;
                        js_sys::Reflect::set(&color_obj, &"b".into(), &JsValue::from_f64(color.b as f64))?;

                        js_sys::Reflect::set(&path_obj, &"color".into(), &color_obj)?;
                        self.post_message(&path_obj)?;
                    }

                    self.counter += 1;
                    Ok(false)
                } else {
                    console::log_1(&format!("Stage: Complete, Progress: {}%", progress).into());
                    Ok(true)
                }
            }
        }
    }

    pub fn progress(&self) -> i32 {
        (match &self.stage {
            Stage::New => 0,
            Stage::Clustering(builder) => builder.progress() / 2,
            Stage::Reclustering(_) => 50,
            Stage::Vectorize(clusters) => {
                50 + 50 * self.counter as u32 / clusters.view().clusters_output.len() as u32
            }
        }) as i32
    }

    fn post_message(&self, path_obj: &js_sys::Object) -> Result<(), JsValue> {
        let message = js_sys::Object::new();
        js_sys::Reflect::set(&message, &"type".into(), &JsValue::from_str("path"))?;
        js_sys::Reflect::set(&message, &"data".into(), path_obj)?;

        if let Some(window) = web_sys::window() {
            window.post_message(&message.into(), "*")?;
            Ok(())
        } else {
            Err(JsValue::from_str("window not available"))
        }
    }
}

fn should_key_image(img: &ColorImage) -> bool {
    if img.width == 0 || img.height == 0 {
        return false;
    }

    const KEYING_THRESHOLD: f32 = 0.2;
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
        if !color_exists_in_image(img, color) {
            return Ok(color);
        }
    }

    Err(String::from("unable to find unused color in image to use as key"))
}

fn color_exists_in_image(img: &ColorImage, color: Color) -> bool {
    for y in 0..img.height {
        for x in 0..img.width {
            let pixel_color = img.get_pixel(x, y);
            if pixel_color.r == color.r && pixel_color.g == color.g && pixel_color.b == color.b {
                return true;
            }
        }
    }
    false
}
