# Set the minimum version of CMake that can be used
cmake_minimum_required(VERSION 3.20)

# Enable compile command to ease indexing with e.g. clangd
set(CMAKE_EXPORT_COMPILE_COMMANDS TRUE)
set(CMAKE_C_COMPILER_FORCED TRUE)
set(CMAKE_CXX_COMPILER_FORCED TRUE)

# Set target definition variables required by the toolchain file
include(${CMAKE_CURRENT_SOURCE_DIR}/cmake/target.cmake)

# Set the toolchain file for cross-compilation
include(${CMAKE_CURRENT_SOURCE_DIR}/cmake/gcc-arm-none-eabi.cmake)

# Project definition
project(van-canbus)

# Enable CMake support for ASM and C/CPP languages
enable_language(C ASM)

set(PROJECT_NAME van-canbus)

# Create an executable object type
add_executable(${PROJECT_NAME})

# Include additional CMake files for flags, components, and files
include(${CMAKE_CURRENT_SOURCE_DIR}/cmake/flags.cmake)
include(${CMAKE_CURRENT_SOURCE_DIR}/cmake/components.cmake)
include(${CMAKE_CURRENT_SOURCE_DIR}/cmake/files.cmake)

# Add sources to executable/library
target_sources(${PROJECT_NAME} PRIVATE
  Src/can_protocol.c
  Src/tx3_sensor.c
  Src/stm32g0xx_hal_msp.c
  Src/stm32g0xx_it.c

  third_party/STM32CubeG0/Drivers/CMSIS/Device/ST/STM32G0xx/Source/Templates/system_stm32g0xx.c

  third_party/STM32CubeG0/Drivers/STM32G0xx_HAL_Driver/Src/stm32g0xx_hal.c
  third_party/STM32CubeG0/Drivers/STM32G0xx_HAL_Driver/Src/stm32g0xx_hal_adc.c
  third_party/STM32CubeG0/Drivers/STM32G0xx_HAL_Driver/Src/stm32g0xx_hal_adc_ex.c
  third_party/STM32CubeG0/Drivers/STM32G0xx_HAL_Driver/Src/stm32g0xx_hal_cortex.c
  third_party/STM32CubeG0/Drivers/STM32G0xx_HAL_Driver/Src/stm32g0xx_hal_dma.c
  third_party/STM32CubeG0/Drivers/STM32G0xx_HAL_Driver/Src/stm32g0xx_hal_fdcan.c
  third_party/STM32CubeG0/Drivers/STM32G0xx_HAL_Driver/Src/stm32g0xx_hal_flash.c
  third_party/STM32CubeG0/Drivers/STM32G0xx_HAL_Driver/Src/stm32g0xx_hal_flash_ex.c
  third_party/STM32CubeG0/Drivers/STM32G0xx_HAL_Driver/Src/stm32g0xx_hal_gpio.c
  third_party/STM32CubeG0/Drivers/STM32G0xx_HAL_Driver/Src/stm32g0xx_hal_pwr.c
  third_party/STM32CubeG0/Drivers/STM32G0xx_HAL_Driver/Src/stm32g0xx_hal_pwr_ex.c
  third_party/STM32CubeG0/Drivers/STM32G0xx_HAL_Driver/Src/stm32g0xx_hal_rcc.c
  third_party/STM32CubeG0/Drivers/STM32G0xx_HAL_Driver/Src/stm32g0xx_hal_rcc_ex.c
)

# Add include directories
target_include_directories(${PROJECT_NAME} PRIVATE
  Inc
  third_party/STM32CubeG0/Drivers/CMSIS/Core/Include
  third_party/STM32CubeG0/Drivers/CMSIS/Device/ST/STM32G0xx/Include
  third_party/STM32CubeG0/Drivers/STM32G0xx_HAL_Driver/Inc
  third_party/STM32CubeG0/Drivers/STM32G0xx_HAL_Driver/Inc/Legacy
)

# Compiler options
target_compile_options(${PROJECT_NAME} PRIVATE
  # User defined compiler options
)

# Add additional defined symbols
target_compile_definitions(${PROJECT_NAME} PRIVATE
  USE_HAL_DRIVER
  STM32G0B1xx
)

# Linker options
target_link_options(${PROJECT_NAME} PRIVATE
  # User defined linker options
)

# Add additional linker search directories
target_link_directories(${PROJECT_NAME} PRIVATE
  # Add additional linker search directories here
)

# Add additional linker libraries
target_link_libraries(${PROJECT_NAME} PRIVATE
  m
)

get_filename_component(ARM_TOOLCHAIN_BIN_DIR "${CMAKE_C_COMPILER}" DIRECTORY)
find_program(ARM_OBJCOPY
  NAMES arm-none-eabi-objcopy
  HINTS "${ARM_TOOLCHAIN_BIN_DIR}"
  NO_DEFAULT_PATH
  REQUIRED
)

add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD
  COMMAND ${ARM_OBJCOPY} -O ihex
          $<TARGET_FILE:${PROJECT_NAME}>
          ${CMAKE_CURRENT_BINARY_DIR}/${PROJECT_NAME}.hex
  COMMAND ${ARM_OBJCOPY} -O binary
          $<TARGET_FILE:${PROJECT_NAME}>
          ${CMAKE_CURRENT_BINARY_DIR}/${PROJECT_NAME}.bin
  COMMENT "Generating Intel HEX and raw binary images"
)
