import javax.inject.Inject
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "vn.hawasuco.hawamap"
    compileSdk = 35

    defaultConfig {
        applicationId = "vn.hawasuco.hawamap"
        minSdk = 26
        targetSdk = 35
        versionCode = 10207
        versionName = "1.2.7"
    }

    signingConfigs {
        // khoá ký cố định cho bản cài thử (không phải bí mật): mọi lần build cùng chữ ký nên cài đè được bản cũ.
        // Đưa lên Google Play thì tạo khoá riêng, giữ kín (hoặc dùng Play App Signing).
        getByName("debug") {
            storeFile = file("khoa-ky/hawamap-thu.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
}

dependencies {
    implementation("androidx.car.app:app:1.4.0")
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.webkit:webkit:1.12.1")
}

/**
 * Chép trang web HawaMap (thư mục ../public) vào assets/web của ứng dụng mỗi lần build,
 * để ứng dụng Android luôn dùng đúng bản trang web trong kho mã.
 */
abstract class ChepTrangWeb : DefaultTask() {
    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val nguon: DirectoryProperty

    @get:OutputDirectory
    abstract val thuMucRa: DirectoryProperty

    @get:Inject
    abstract val tep: FileSystemOperations

    @TaskAction
    fun chep() {
        tep.sync {
            from(nguon) { exclude("web.config", "sw.js") }
            into(thuMucRa.dir("web"))
        }
    }
}

val thuMucTrangWeb = rootProject.layout.projectDirectory.dir("../public")

androidComponents {
    onVariants { variant ->
        // mỗi biến thể (debug / release) một tác vụ chép, AGP tự đặt thư mục ra và nối vào assets
        val chep = tasks.register<ChepTrangWeb>("chepTrangWeb" + variant.name.replaceFirstChar { it.uppercase() }) {
            nguon.set(thuMucTrangWeb)
        }
        variant.sources.assets?.addGeneratedSourceDirectory(chep, ChepTrangWeb::thuMucRa)
    }
}
