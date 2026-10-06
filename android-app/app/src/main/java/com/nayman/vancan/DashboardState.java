package com.nayman.vancan;

import com.nayman.vancan.protocol.CanFrame;
import com.nayman.vancan.protocol.VanCanDecoder;

import java.io.File;
import java.util.ArrayDeque;
import java.util.Deque;

/** Mutable UI model. MainActivity only changes it on Android's main thread. */
public final class DashboardState {
    public String connectionText = "U2C not connected";
    public boolean usbConnected;
    public boolean trafficRecent;
    public boolean permissionPending;
    public long lastFrameAt;
    public long totalFrames;
    public int framesPerSecond;
    public VanCanDecoder.Heartbeat heartbeat;
    public VanCanDecoder.CoolantReading coolant;
    public VanCanDecoder.CoolantReading coolantPost;
    public boolean logging;
    public File latestLog;
    public final Deque<CanFrame> recentFrames = new ArrayDeque<>();
}
