use wasm_bindgen::prelude::*;
use web_sys::{ImageData, console};
use visioncortex::{
    Color, ColorImage,
    color_clusters::{
        Runner,
        RunnerConfig,
        KeyingAction,
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

#[wasm_bindgen]
pub fn process_image(image_data: ImageData, options: TraceOptions) -> Result<JsValue, JsValue> {
    console::log_1(&"Starting image processing".into());

    let width = image_data.width() as usize;
    let height = image_data.height() as usize;
    let data = image_data.data();

    console::log_1(&format!("Image dimensions: {}x{}", width, height).into());

    // Create color image directly from raw data
    let mut color_image = ColorImage::new();
    color_image.pixels = data.to_vec();
    color_image.width = width;
    color_image.height = height;

    // Verify image data
    if color_image.pixels.len() != width * height * 4 {
        return Err(JsValue::from_str(&format!(
            "Invalid image data size: {} != {}",
            color_image.pixels.len(),
            width * height * 4
        )));
    }

    console::log_1(&"Color image created".into());

    // Verify config values before creating runner
    if options.batch_size <= 0 {
        return Err(JsValue::from_str("Invalid batch size"));
    }
    if options.good_min_area <= 0 {
        return Err(JsValue::from_str("Invalid good_min_area"));
    }
    if options.good_max_area <= 0 {
        return Err(JsValue::from_str("Invalid good_max_area"));
    }
    if options.is_same_color_a <= 0 {
        return Err(JsValue::from_str("Invalid is_same_color_a"));
    }
    if options.is_same_color_b <= 0 {
        return Err(JsValue::from_str("Invalid is_same_color_b"));
    }
    if options.deepen_diff <= 0 {
        return Err(JsValue::from_str("Invalid deepen_diff"));
    }

    let runner_config = RunnerConfig {
        diagonal: options.diagonal,
        hierarchical: options.hierarchical,
        batch_size: options.batch_size,
        good_min_area: options.good_min_area,
        good_max_area: options.good_max_area,
        is_same_color_a: options.is_same_color_a,
        is_same_color_b: options.is_same_color_b,
        deepen_diff: options.deepen_diff,
        hollow_neighbours: options.hollow_neighbours,
        key_color: Color::default(),
        keying_action: KeyingAction::default(),
    };

    console::log_1(&format!(
        "Runner config: batch_size={}, good_min_area={}, good_max_area={}, is_same_color_a={}, is_same_color_b={}, deepen_diff={}",
        runner_config.batch_size,
        runner_config.good_min_area,
        runner_config.good_max_area,
        runner_config.is_same_color_a,
        runner_config.is_same_color_b,
        runner_config.deepen_diff
    ).into());

    console::log_1(&"Starting color clustering".into());
    let runner = Runner::new(runner_config, color_image);

    let clusters = runner.run();
    console::log_1(&format!("Found {} clusters", clusters.view().clusters_output.len()).into());

    // Process clusters into paths
    let paths = js_sys::Array::new();
    let view = clusters.view();

    for (index, cluster_idx) in view.clusters_output.iter().enumerate() {
        console::log_1(&format!("Processing cluster {}", index).into());

        let cluster = view.get_cluster(*cluster_idx);
        let color = cluster.residue_color();

        // Create binary image for this cluster
        let mut binary_image = BinaryImage::new_w_h(view.width as usize, view.height as usize);
        cluster.render_to_binary_image(&view, &mut binary_image);

        // Create a spline from the binary image
        let spline = visioncortex::Spline::from_image(
            &binary_image,
            true, // clockwise
            options.corner_threshold.to_radians(),
            1.0, // outset_ratio
            1.0, // segment_length
            4,   // max_iterations
            options.splice_threshold.to_radians(), // splice_threshold
        );

        // Convert spline to SVG path string
        let path_string = spline.to_svg_string(true, &visioncortex::PointF64::default(), Some(options.path_precision));

        let path_obj = js_sys::Object::new();
        js_sys::Reflect::set(&path_obj, &"path".into(), &JsValue::from_str(&path_string))?;

        let color_obj = js_sys::Object::new();
        js_sys::Reflect::set(&color_obj, &"r".into(), &JsValue::from_f64(color.r as f64))?;
        js_sys::Reflect::set(&color_obj, &"g".into(), &JsValue::from_f64(color.g as f64))?;
        js_sys::Reflect::set(&color_obj, &"b".into(), &JsValue::from_f64(color.b as f64))?;

        js_sys::Reflect::set(&path_obj, &"color".into(), &color_obj)?;
        paths.push(&path_obj);
    }

    console::log_1(&"Creating result object".into());
    // Create result object
    let result = js_sys::Object::new();

    js_sys::Reflect::set(
        &result,
        &"paths".into(),
        &paths.into()
    )?;

    js_sys::Reflect::set(
        &result,
        &"width".into(),
        &JsValue::from_f64(width as f64)
    )?;

    js_sys::Reflect::set(
        &result,
        &"height".into(),
        &JsValue::from_f64(height as f64)
    )?;

    console::log_1(&"Image processing complete".into());
    Ok(result.into())
}
