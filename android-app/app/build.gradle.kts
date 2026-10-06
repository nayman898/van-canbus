plugins {
    id("com.android.application")
}

android {
    namespace = "com.nayman.vancan"
    // API 36 is the newest platform supported by the installed AGP 8.13 toolchain.
    compileSdk = 36

    defaultConfig {
        applicationId = "com.nayman.vancan"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}
