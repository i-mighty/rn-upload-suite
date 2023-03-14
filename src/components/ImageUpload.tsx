import React, { forwardRef, useImperativeHandle, ReactNode, useState } from "react"
import * as ImagePicker from "expo-image-picker"
import { Image, ImageStyle, View, ViewStyle, TouchableOpacity } from "react-native"
import { ImagePickerAsset, ImagePickerOptions } from "expo-image-picker"
import { widthPercentageToDP as wp } from "react-native-responsive-screen"

export interface Asset extends ImagePickerAsset {
  blob: Blob
}

type UploadStatus =
  | "none"
  | "upload-failed"
  | "single-upload-success"
  | "multiple-upload-success"
  | "single-upload-failed"
  | "multiple-upload-failed"

export interface UploadAsset {
  state: "success" | "failed" | unknown
  asset: Asset
}

export interface ImageUploadProps extends ImagePickerOptions {
  /**
   * This is the trigger element for the image selection button
   * Opens the camera or the library based on the mode passed
   *  @accepts ReactNode and ReactNode[]
   */
  children?: ReactNode | ReactNode[]
  /**
   * Determines if the image is selected from the camera or from the image library.
   * @accepts "camera" | "library"
   */
  mode?: "camera" | "library"
  /**
   * Function to handle the image upload to the storage
   * @param assets can be a single asset or an assets
   * @returns an upload asset (Asset appended with upload status) or an upload asset array.
   */
  uploadAction: <T extends Asset | Asset[]>(
    assets: T,
  ) => Promise<T extends Asset ? UploadAsset : UploadAsset[]>
  /**
   * Action to perform if the picker or camera fails and no image asset is selected
   * @returns void
   */
  handleImageSelectionError?: () => void
  /**
   * Function to handle the error on uploading the files.
   * @param assets can be a single upload asset (Asset appended with status) or an array of upload assets
   * @returns
   */
  handleImageUploadError?: (assets: UploadAsset | UploadAsset[]) => void
}

export interface ImageUploadRef {
  /**
   * Default status of the file upload process
   */
  uploadStatus: UploadStatus
  /**
   * Indicates wether files are actively being (network) uploaded at the moment
   */
  uploading: boolean
  /**
   * Triggers the start of the image selection process. Opens the camera or the library based on the mode passed
   * @returns void
   */
  imageSelectionAction: () => Promise<void>
}

export const ImageUpload = forwardRef<ImageUploadRef, ImageUploadProps>(
  (
    {
      children,
      uploadAction,
      mode = "library",
      handleImageSelectionError,
      handleImageUploadError,
      ...pickerOptions
    },
    ref,
  ) => {
    const [uploadStatus, setUploadStatus] = useState<UploadStatus>("none")
    const [uploading, setUploading] = useState(false)
    const pickerImage = require("../../assets/file-picker-icons/upload-image.png")
    const cameraImage = require("../../assets/file-picker-icons/camera-upload.png")

    const openImagePickerAsync = async () => {
      let pickerResult: ImagePicker.ImagePickerResult | null = null
      try {
        if (mode == "library") {
          pickerResult = await ImagePicker.launchImageLibraryAsync({
            ...pickerOptions,
          })
        } else if (mode == "camera") {
          pickerResult = await ImagePicker.launchCameraAsync({
            ...pickerOptions,
          })
        }

        if (pickerResult && !pickerResult.canceled) {
          setUploading(true)
          const { assets } = pickerResult
          const assetsWithBlob = await Promise.all(
            assets.map(async (asset) => {
              return {
                ...asset,
                blob: await (await fetch(asset.uri)).blob(),
              }
            }),
          )

          if (!pickerOptions.allowsMultipleSelection) {
            const asset = assetsWithBlob[0]
            const uploadRes = await uploadAction(asset)
            if (uploadRes.state == "success") {
              setUploadStatus("single-upload-success")
              setUploading(false)
            } else {
              setUploadStatus("single-upload-failed")
              handleImageUploadError && handleImageUploadError(uploadRes)
              setUploading(false)
            }
          }
          if (pickerOptions.allowsMultipleSelection) {
            const uploadRes = await uploadAction(assetsWithBlob)
            if (uploadRes.every((val) => val.state == "success")) {
              setUploadStatus("multiple-upload-success")
              setUploading(false)
            } else {
              setUploadStatus("single-upload-failed")
              handleImageUploadError && handleImageUploadError(uploadRes)
              setUploading(false)
            }
          }
        } else {
          handleImageSelectionError && handleImageSelectionError()
        }
      } catch (error) {
        console.log(error)
      }
    }
    useImperativeHandle(
      ref,
      () => ({
        uploadStatus,
        uploading,
        imageSelectionAction: openImagePickerAsync,
      }),
      [],
    )
    return (
      <TouchableOpacity onPress={() => openImagePickerAsync()}>
        {children || (
          <View style={$baseView}>
            <Image
              style={$imageIcon}
              source={mode == "camera" ? cameraImage : pickerImage}
              resizeMode="contain"
            />
          </View>
        )}
      </TouchableOpacity>
    )
  },
)

const $baseView: ViewStyle = {
  justifyContent: "center",
  alignItems: "center",
}
const $imageIcon: ImageStyle = {
  width: wp(10),
  height: wp(10),
}
